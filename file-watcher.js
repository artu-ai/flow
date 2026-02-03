/**
 * File watcher manager - watches directories for changes and notifies WebSocket clients.
 * Stored on globalThis to ensure a single instance across module reloads.
 */

import { watch, existsSync } from 'node:fs';
import { dirname } from 'node:path';

class FileWatcher {
	constructor() {
		/** @type {Map<string, { watcher: import('node:fs').FSWatcher, clients: Set<import('ws').WebSocket>, debounceTimers: Map<string, NodeJS.Timeout> }>} */
		this.roots = new Map();
	}

	/**
	 * @param {string} root
	 * @param {import('ws').WebSocket} ws
	 */
	subscribe(root, ws) {
		if (!existsSync(root)) {
			console.error(`File watcher: path does not exist, skipping: ${root}`);
			ws.close(4004, 'Path does not exist');
			return;
		}

		let entry = this.roots.get(root);

		if (!entry) {
			const clients = new Set();
			const debounceTimers = new Map();

			let watcher;
			try {
				watcher = watch(root, { recursive: true }, (_event, filename) => {
					if (!filename) return;
					if (filename.startsWith('.git/') || filename.startsWith('.git\\') || filename === '.git') return;

					const dir = dirname(filename);
					const normalizedDir = dir === '.' ? '.' : dir.replace(/\\/g, '/');

					if (debounceTimers.has(normalizedDir)) {
						clearTimeout(debounceTimers.get(normalizedDir));
					}

					debounceTimers.set(
						normalizedDir,
						setTimeout(() => {
							debounceTimers.delete(normalizedDir);
							const msg = JSON.stringify({ type: 'change', dir: normalizedDir });
							for (const client of clients) {
								if (client.readyState === client.OPEN) {
									client.send(msg);
								}
							}
						}, 200)
					);
				});
			} catch (err) {
				console.error(`File watcher: failed to watch ${root}:`, err.message);
				ws.close(4004, 'Failed to watch path');
				return;
			}

			watcher.on('error', (err) => {
				console.error(`File watcher error for ${root}:`, err.message);
			});

			entry = { watcher, clients, debounceTimers };
			this.roots.set(root, entry);
		}

		entry.clients.add(ws);
	}

	/**
	 * @param {string} root
	 * @param {import('ws').WebSocket} ws
	 */
	unsubscribe(root, ws) {
		const entry = this.roots.get(root);
		if (!entry) return;

		entry.clients.delete(ws);

		if (entry.clients.size === 0) {
			for (const timer of entry.debounceTimers.values()) {
				clearTimeout(timer);
			}
			entry.watcher.close();
			this.roots.delete(root);
		}
	}

	destroyAll() {
		for (const [, entry] of this.roots) {
			for (const timer of entry.debounceTimers.values()) {
				clearTimeout(timer);
			}
			entry.watcher.close();
		}
		this.roots.clear();
	}
}

/** @type {FileWatcher} */
const manager = /** @type {any} */ (globalThis).__fileWatcher || new FileWatcher();
/** @type {any} */ (globalThis).__fileWatcher = manager;

export const fileWatcher = manager;
