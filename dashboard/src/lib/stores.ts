import { writable } from 'svelte/store';

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
export const currentFile = writable<string | null>(null);
export const activeView = writable<ViewTab>('editor');
export const diffBase = writable<DiffBase>('head');
export const worktrees = writable<Worktree[]>([]);
export const terminalSessionId = writable<string | null>(null);

export type InlineEditAction =
	| { type: 'newFile'; parentPath: string }
	| { type: 'newDir'; parentPath: string }
	| { type: 'rename'; path: string; currentName: string };

export const inlineEdit = writable<InlineEditAction | null>(null);

/** Maps file paths to their git status for the current worktree. */
export const gitFileStatuses = writable<Map<string, GitFileStatus>>(new Map());

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
