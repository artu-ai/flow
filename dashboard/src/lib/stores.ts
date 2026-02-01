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

export const currentWorktree = writable<Worktree | null>(null);
export const currentFile = writable<string | null>(null);
export const activeView = writable<ViewTab>('editor');
export const diffBase = writable<DiffBase>('head');
export const worktrees = writable<Worktree[]>([]);
export const terminalSessionId = writable<string | null>(null);
