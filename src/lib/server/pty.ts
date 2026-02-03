export interface PtySessionInfo {
	id: string;
	worktree: string;
	createdAt: string;
}

interface PtyManagerInstance {
	createSession(worktree: string): Promise<{ id: string; worktree: string; createdAt: Date }>;
	getSession(id: string): { id: string; pty: any; worktree: string; createdAt: Date } | undefined;
	resize(id: string, cols: number, rows: number): void;
	destroy(id: string): void;
	listSessions(): PtySessionInfo[];
	destroyAll(): void;
}

// Access the shared global PTY manager instance
// At runtime, this is initialized by pty-manager.js (loaded by server.js)
function getManager(): PtyManagerInstance {
	const mgr = (globalThis as any).__ptyManager;
	if (!mgr) {
		throw new Error('PTY manager not initialized. The dashboard must be started via server.js.');
	}
	return mgr;
}

export const ptyManager = {
	createSession: (worktree: string) => getManager().createSession(worktree),
	getSession: (id: string) => getManager().getSession(id),
	resize: (id: string, cols: number, rows: number) => getManager().resize(id, cols, rows),
	listSessions: () => getManager().listSessions(),
	destroy: (id: string) => getManager().destroy(id),
	destroyAll: () => getManager().destroyAll(),
};
