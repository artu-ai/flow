import { writable } from 'svelte/store';
import { browser } from '$app/environment';

function localPersistedWritable<T>(key: string, initial: T) {
	const stored = browser ? localStorage.getItem(key) : null;
	const value = stored !== null ? JSON.parse(stored) as T : initial;
	const store = writable<T>(value);
	if (browser) {
		store.subscribe((v) => {
			if (v === null || v === undefined) {
				localStorage.removeItem(key);
			} else {
				localStorage.setItem(key, JSON.stringify(v));
			}
		});
	}
	return store;
}

function persistedWritable<T>(key: string, initial: T) {
	const stored = browser ? sessionStorage.getItem(key) : null;
	const value = stored !== null ? JSON.parse(stored) as T : initial;
	const store = writable<T>(value);
	if (browser) {
		store.subscribe((v) => {
			if (v === null || v === undefined) {
				sessionStorage.removeItem(key);
			} else {
				sessionStorage.setItem(key, JSON.stringify(v));

                
			}
		});
	}
	return store;
}

export type ViewTab = 'editor' | 'diff';

export interface Worktree {
	path: string;
	branch: string;
	head: string;
	isMain: boolean;
	issueId: string | null;
}

export interface FileEntry {
	name: string;
	type: 'file' | 'directory';
	size: number;
}

export type DiffBase = 'head' | 'main';

export type GitFileStatus = 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'none';

export const currentWorktree = writable<Worktree | null>(null);
export const currentFile = localPersistedWritable<Record<string, string | null>>('dashboard:worktreeFiles', {});
export const activeView = persistedWritable<ViewTab>('dashboard:activeView', 'editor');
export const diffBase = writable<DiffBase>('head');
export const worktrees = writable<Worktree[]>([]);
/** Maps worktree path → array of terminal session IDs (order = tab order). */
export const terminalSessions = writable<Record<string, string[]>>({});
/** Maps worktree path → currently active terminal session ID. */
export const activeTerminalSession = writable<Record<string, string>>({});
export const hasUnsavedChanges = writable<Record<string, boolean>>({});
export const selectedWorktreePath = persistedWritable<string | null>('dashboard:worktreePath', null);
export const sidebarWidth = persistedWritable<number>('dashboard:sidebarWidth', 256);
export const terminalWidth = persistedWritable<number>('dashboard:terminalWidth', 480);
export const terminalHeight = persistedWritable<number>('dashboard:terminalHeight', 300);
export type TerminalLayout = 'right' | 'bottom';
export const terminalLayout = persistedWritable<TerminalLayout>('dashboard:terminalLayout', 'right');
export const worktreeOrder = persistedWritable<string[]>('dashboard:worktreeOrder', []);
export const hiddenWorktrees = persistedWritable<string[]>('dashboard:hiddenWorktrees', []);
export const terminalChatInputEnabled = persistedWritable<boolean>('dashboard:terminalChatInput', true);
export const previousWorktreePath = writable<string | null>(null);
export const showGitIgnored = persistedWritable<boolean>('dashboard:showGitIgnored', false);

export interface FormatterConfig {
	biome: boolean;
}
export const formatterConfig = localPersistedWritable<FormatterConfig>('dashboard:formatterConfig', {
	biome: true,
});

export interface LinterConfig {
	biome: boolean;
	eslint: boolean;
	ruff: boolean;
}
export const linterConfig = localPersistedWritable<LinterConfig>('dashboard:linterConfig', {
	biome: true,
	eslint: true,
	ruff: true,
});
export const linearApiKey = writable<string | null>(null);

export interface CompletionConfig {
	activeProvider: 'ollama' | 'claude' | null;
	ollama: { url: string; model: string };
	claude: { apiKey: string; model: string };
}

export const completionConfig = writable<CompletionConfig>({
	activeProvider: null,
	ollama: { url: 'http://localhost:11434', model: '' },
	claude: { apiKey: '', model: 'claude-3-5-haiku-20241022' },
});

export async function loadGlobalConfig(): Promise<void> {
	try {
		const res = await fetch('/api/config');
		const config = await res.json();

		// Detect project change and clear stale session state
		if (browser && config.projectRoot) {
			const storedRoot = localStorage.getItem('dashboard:projectRoot');
			if (storedRoot && storedRoot !== config.projectRoot) {
				const sessionKeys: string[] = [];
				for (let i = 0; i < sessionStorage.length; i++) {
					const key = sessionStorage.key(i);
					if (key?.startsWith('dashboard:')) sessionKeys.push(key);
				}
				for (const key of sessionKeys) sessionStorage.removeItem(key);
			}
			localStorage.setItem('dashboard:projectRoot', config.projectRoot);
		}

		if (config.linear?.apiKey) {
			linearApiKey.set(config.linear.apiKey);
		}
		if (config.completion) {
			completionConfig.set(config.completion);
		}
	} catch {
		// Server not available — keep defaults
	}
}

export async function saveGlobalConfig(): Promise<void> {
	let linear: { apiKey: string | null } = { apiKey: null };
	let completion: CompletionConfig | undefined;

	linearApiKey.subscribe((v) => { linear = { apiKey: v }; })();
	completionConfig.subscribe((v) => { completion = v; })();

	try {
		await fetch('/api/config', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ linear, completion }),
		});
	} catch {
		// Silent failure
	}
}

/** Active panel on phone layout: which single panel is visible */
export const activePhonePanel = writable<'editor' | 'terminal'>('editor');

/** Which panel was last focused per worktree path: 'editor' or 'terminal' */
export const focusedPanel = writable<Record<string, 'editor' | 'terminal'>>({});

export type InlineEditAction =
	| { type: 'newFile'; parentPath: string }
	| { type: 'newDir'; parentPath: string }
	| { type: 'rename'; path: string; currentName: string };

export const inlineEdit = writable<InlineEditAction | null>(null);

/** Maps worktree path → file path → git status. */
export const gitFileStatuses = writable<Record<string, Map<string, GitFileStatus>>>({});

const STATUS_PRIORITY: Record<GitFileStatus, number> = {
	modified: 4,
	deleted: 3,
	added: 2,
	untracked: 2,
	renamed: 1,
	none: 0,
};

export function statusColor(status: GitFileStatus): string {
	switch (status) {
		case 'modified': return '!text-amber-400';
		case 'added': return '!text-green-400';
		case 'untracked': return '!text-green-400';
		case 'deleted': return '!text-red-400';
		case 'renamed': return '!text-blue-400';
		default: return '';
	}
}

/** Get the dominant git status for a directory by checking all descendant files. */
export function folderStatus(dirPath: string, statuses: Map<string, GitFileStatus>): GitFileStatus {
	const prefix = dirPath + '/';
	let best: GitFileStatus = 'none';
	for (const [path, status] of statuses) {
		if (path.startsWith(prefix) && STATUS_PRIORITY[status] > STATUS_PRIORITY[best]) {
			best = status;
		}
	}
	return best;
}
