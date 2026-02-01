import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface Worktree {
	path: string;
	branch: string;
	head: string;
	isMain: boolean;
	issueId: string | null;
}

export interface GitFileStatus {
	path: string;
	status: string;
	staged: string;
}

export interface GitStatus {
	branch: string;
	files: GitFileStatus[];
}

export interface DiffResult {
	original: string;
	modified: string;
	filename: string;
}

/**
 * Parse `git worktree list --porcelain` output into structured data.
 */
export async function listWorktrees(repoPath: string): Promise<Worktree[]> {
	const { stdout } = await execFileAsync('git', ['worktree', 'list', '--porcelain'], {
		cwd: repoPath,
	});
	const blocks = stdout.trim().split('\n\n');
	const worktrees: Worktree[] = [];

	for (const block of blocks) {
		if (!block.trim()) continue;
		const lines = block.split('\n');
		let path = '';
		let head = '';
		let branch = '';
		let isMain = false;

		for (const line of lines) {
			if (line.startsWith('worktree ')) {
				path = line.slice('worktree '.length);
			} else if (line.startsWith('HEAD ')) {
				head = line.slice('HEAD '.length);
			} else if (line.startsWith('branch ')) {
				branch = line.slice('branch '.length).replace('refs/heads/', '');
			}
		}

		if (worktrees.length === 0) {
			isMain = true;
		}

		const issueMatch = branch.match(/([a-zA-Z]+-\d+)/i);
		const issueId = issueMatch ? issueMatch[1].toUpperCase() : null;

		worktrees.push({ path, branch, head, isMain, issueId });
	}

	return worktrees;
}

/**
 * Parse `git status --porcelain -b` for a given worktree.
 */
export async function getStatus(worktreePath: string): Promise<GitStatus> {
	const { stdout } = await execFileAsync('git', ['status', '--porcelain', '-b', '--untracked-files=all'], {
		cwd: worktreePath,
	});
	const lines = stdout.split('\n').filter(Boolean);
	let branch = '';
	const files: GitFileStatus[] = [];

	for (const line of lines) {
		if (line.startsWith('## ')) {
			branch = line.slice(3).split('...')[0];
		} else if (line.length >= 3) {
			const staged = line[0];
			const status = line[1];
			const path = line.slice(3);
			files.push({ path, status, staged });
		}
	}

	return { branch, files };
}

/**
 * Get diff for a specific file: HEAD version vs working copy.
 */
export async function getFileDiff(worktreePath: string, filePath: string): Promise<DiffResult> {
	let original = '';
	try {
		const { stdout } = await execFileAsync('git', ['show', `HEAD:${filePath}`], {
			cwd: worktreePath,
		});
		original = stdout;
	} catch {
		original = '';
	}

	const { readFile } = await import('node:fs/promises');
	const { join } = await import('node:path');
	let modified = '';
	try {
		modified = await readFile(join(worktreePath, filePath), 'utf-8');
	} catch {
		modified = '';
	}

	return { original, modified, filename: filePath };
}
