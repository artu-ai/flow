/**
 * PTY session manager - shared between custom server and SvelteKit routes.
 * Stored on globalThis to ensure a single instance across module boundaries.
 */

/** @type {import('node-pty') | null} */
let ptyModule = null;

async function getPty() {
	if (!ptyModule) {
		ptyModule = await import('node-pty');
	}
	return ptyModule;
}

class PtyManager {
	constructor() {
		/** @type {Map<string, {id: string, pty: import('node-pty').IPty, worktree: string, createdAt: Date}>} */
		this.sessions = new Map();
		this.counter = 0;
	}

	/** @param {string} worktree */
	async createSession(worktree) {
		const pty = await getPty();
		const id = `pty-${++this.counter}`;
		const shell = process.env.SHELL || '/bin/zsh';

		const ptyProcess = pty.spawn(shell, [], {
			name: 'xterm-256color',
			cols: 120,
			rows: 30,
			cwd: worktree,
			env: /** @type {Record<string, string>} */ ({ ...process.env, TERM: 'xterm-256color' }),
		});

		const session = { id, pty: ptyProcess, worktree, createdAt: new Date() };
		this.sessions.set(id, session);
		return session;
	}

	/** @param {string} id */
	getSession(id) {
		return this.sessions.get(id);
	}

	/**
	 * @param {string} id
	 * @param {number} cols
	 * @param {number} rows
	 */
	resize(id, cols, rows) {
		const session = this.sessions.get(id);
		if (session) session.pty.resize(cols, rows);
	}

	/** @param {string} id */
	destroy(id) {
		const session = this.sessions.get(id);
		if (session) {
			session.pty.kill();
			this.sessions.delete(id);
		}
	}

	listSessions() {
		return Array.from(this.sessions.values()).map((s) => ({
			id: s.id,
			worktree: s.worktree,
			createdAt: s.createdAt.toISOString(),
		}));
	}

	destroyAll() {
		for (const [id] of this.sessions) {
			this.destroy(id);
		}
	}
}

/** @type {PtyManager} */
const manager = /** @type {any} */ (globalThis).__ptyManager || new PtyManager();
/** @type {any} */ (globalThis).__ptyManager = manager;

export const ptyManager = manager;
