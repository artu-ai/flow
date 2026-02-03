import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { WebSocketServer } from 'ws';
import { ptyManager } from './pty-manager.js';
import { fileWatcher } from './file-watcher.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { handler } = await import(join(__dirname, 'build', 'handler.js'));

const PORT = parseInt(process.env.PORT || '3420', 10);
const HOST = process.env.HOST || '127.0.0.1';

if (process.env.PROJECT_ROOT) {
	console.log(`PROJECT_ROOT: ${process.env.PROJECT_ROOT}`);
}

const server = createServer(handler);
const wss = new WebSocketServer({ noServer: true });
const watchWss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
	const url = new URL(req.url || '/', `http://${req.headers.host}`);

	const terminalMatch = url.pathname.match(/^\/terminal\/(.+)$/);
	if (terminalMatch) {
		wss.handleUpgrade(req, socket, head, (ws) => {
			wss.emit('connection', ws, req, terminalMatch[1]);
		});
		return;
	}

	if (url.pathname === '/watch') {
		const root = url.searchParams.get('root');
		if (!root) {
			socket.destroy();
			return;
		}
		watchWss.handleUpgrade(req, socket, head, (ws) => {
			fileWatcher.subscribe(root, ws);
			ws.on('close', () => {
				fileWatcher.unsubscribe(root, ws);
			});
		});
		return;
	}

	socket.destroy();
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
	fileWatcher.destroyAll();
	wss.close();
	watchWss.close();
	server.close(() => {
		process.exit(0);
	});
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

server.listen(PORT, HOST, () => {
	console.log(`Dashboard running at http://${HOST}:${PORT}`);
	// Notify parent process (daemon) that we're ready
	if (process.send) {
		process.send({ type: 'ready', port: PORT });
	}
});
