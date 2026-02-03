import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';

function terminalPlugin(): Plugin {
	return {
		name: 'terminal-websocket',
		configureServer(server) {
			// Dynamically import the PTY manager to initialize globalThis.__ptyManager
			import('./pty-manager.js').then(({ ptyManager }) => {
				// Import ws for WebSocket handling
				import('ws').then(({ WebSocketServer }) => {
					const wss = new WebSocketServer({ noServer: true });

					server.httpServer?.on(
						'upgrade',
						(req: IncomingMessage, socket: Duplex, head: Buffer) => {
							const url = new URL(req.url || '/', `http://${req.headers.host}`);
							const match = url.pathname.match(/^\/terminal\/(.+)$/);

							if (!match) return; // Let Vite handle its own HMR WebSocket

							wss.handleUpgrade(req, socket, head, (ws) => {
								const sessionId = match[1];
								const session = ptyManager.getSession(sessionId);
								if (!session) {
									ws.close(4004, 'Session not found');
									return;
								}

								const onData = session.pty.onData((data: string) => {
									if (ws.readyState === ws.OPEN) {
										ws.send(data);
									}
								});

								ws.on('message', (msg: Buffer) => {
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
						}
					);
				});
			});
		},
	};
}

function fileWatcherPlugin(): Plugin {
	return {
		name: 'file-watcher-websocket',
		configureServer(server) {
			import('./file-watcher.js').then(({ fileWatcher }) => {
				import('ws').then(({ WebSocketServer }) => {
					const wss = new WebSocketServer({ noServer: true });

					server.httpServer?.on(
						'upgrade',
						(req: IncomingMessage, socket: Duplex, head: Buffer) => {
							const url = new URL(req.url || '/', `http://${req.headers.host}`);

							if (url.pathname !== '/watch') return;

							const root = url.searchParams.get('root');
							if (!root) {
								socket.destroy();
								return;
							}

							wss.handleUpgrade(req, socket, head, (ws) => {
								fileWatcher.subscribe(root, ws);
								ws.on('close', () => {
									fileWatcher.unsubscribe(root, ws);
								});
							});
						}
					);
				});
			});
		},
	};
}

export default defineConfig({
	plugins: [sveltekit(), terminalPlugin(), fileWatcherPlugin()],
	server: {
		port: 3420,
	},
});
