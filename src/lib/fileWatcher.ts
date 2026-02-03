import { writable, type Readable } from 'svelte/store';

export interface FileChange {
	dir: string;
	tick: number;
}

export function createFileWatcher(root: string): { changes: Readable<FileChange>; destroy: () => void } {
	const store = writable<FileChange>({ dir: '', tick: 0 });
	let ws: WebSocket | null = null;
	let destroyed = false;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

	function connect() {
		if (destroyed) return;

		const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
		const url = `${protocol}//${location.host}/watch?root=${encodeURIComponent(root)}`;
		ws = new WebSocket(url);

		ws.onmessage = (event) => {
			try {
				const msg = JSON.parse(event.data);
				if (msg.type === 'change') {
					store.update((s) => ({ dir: msg.dir, tick: s.tick + 1 }));
				}
			} catch {
				// ignore malformed messages
			}
		};

		ws.onclose = () => {
			if (!destroyed) {
				reconnectTimer = setTimeout(connect, 1000);
			}
		};

		ws.onerror = () => {
			// onclose will fire after this, triggering reconnect
		};
	}

	connect();

	return {
		changes: { subscribe: store.subscribe },
		destroy() {
			destroyed = true;
			if (reconnectTimer) clearTimeout(reconnectTimer);
			if (ws) {
				ws.onclose = null;
				ws.close();
			}
		},
	};
}
