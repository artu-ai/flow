import { createServer } from 'node:http';
import { handler } from './build/handler.js';
import { WebSocketServer } from 'ws';
import { ptyManager } from './pty-manager.js';

const PORT = parseInt(process.env.PORT || '3420', 10);
const HOST = process.env.HOST || '127.0.0.1';

const server = createServer(handler);

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
	const url = new URL(req.url || '/', `http://${req.headers.host}`);
	const match = url.pathname.match(/^\/terminal\/(.+)$/);

	if (!match) {
		socket.destroy();
		return;
	}

	wss.handleUpgrade(req, socket, head, (ws) => {
		wss.emit('connection', ws, req, match[1]);
	});
});

wss.on('connection', (ws, _req, sessionId) => {
	const session = ptyManager.getSession(sessionId);
	if (!session) {
		ws.close(4004, 'Session not found');
		return;
	}

	const onData = session.pty.onData((data) => {
		if (ws.readyState === ws.OPEN) {
			ws.send(data);
		}
	});

	ws.on('message', (msg) => {
		const data = msg.toString();

		// Handle resize messages
		try {
			const parsed = JSON.parse(data);
			if (parsed.type === 'resize' && parsed.cols && parsed.rows) {
				ptyManager.resize(sessionId, parsed.cols, parsed.rows);
				return;
			}
		} catch {
			// Not JSON, treat as terminal input
		}

		session.pty.write(data);
	});

	ws.on('close', () => {
		onData.dispose();
	});
});

function shutdown() {
	console.log('Shutting down...');
	ptyManager.destroyAll();
	wss.close();
	server.close(() => {
		process.exit(0);
	});
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

server.listen(PORT, HOST, () => {
	console.log(`Dashboard running at http://${HOST}:${PORT}`);
});
