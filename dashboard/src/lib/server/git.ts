import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { copyFile, access } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';

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
 * Get diff for a specific file.
 * base='head' → HEAD vs working copy (uncommitted changes)
 * base='main' → main branch vs working copy (branch diff)
 */
export async function getFileDiff(worktreePath: string, filePath: string, base: string = 'head'): Promise<DiffResult> {
	const ref = base === 'main' ? await getMainBranchRef(worktreePath) : 'HEAD';

	let original = '';
	try {
		const { stdout } = await execFileAsync('git', ['show', `${ref}:${filePath}`], {
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

/**
 * Get the ref for the main branch (handles both 'main' and 'master').
 */
async function getMainBranchRef(worktreePath: string): Promise<string> {
	for (const name of ['main', 'master']) {
		try {
			await execFileAsync('git', ['rev-parse', '--verify', name], { cwd: worktreePath });
			return name;
		} catch {
			continue;
		}
	}
	return 'main';
}

export interface BranchDiffFile {
	path: string;
	status: string;
}

/**
 * List files changed between main branch and HEAD.
 */
export async function getBranchDiffFiles(worktreePath: string): Promise<BranchDiffFile[]> {
	const mainRef = await getMainBranchRef(worktreePath);
	try {
		const { stdout } = await execFileAsync('git', ['diff', '--name-status', `${mainRef}...HEAD`], {
			cwd: worktreePath,
		});
		return stdout.trim().split('\n').filter(Boolean).map((line) => {
			const [status, ...rest] = line.split('\t');
			return { path: rest.join('\t'), status };
		});
	} catch {
		return [];
	}
}

/**
 * Create a new git worktree with a new branch, push upstream, and copy .env if present.
 */
export async function createWorktree(repoPath: string, branchName: string): Promise<{ worktree: Worktree; worktreePath: string }> {
	const { stdout: repoRoot } = await execFileAsync('git', ['rev-parse', '--show-toplevel'], { cwd: repoPath });
	const root = repoRoot.trim();
	const dirSuffix = branchName.replace(/\//g, '-');
	const worktreePath = join(dirname(root), basename(root) + '-' + dirSuffix);

	try {
		await execFileAsync('git', ['worktree', 'add', worktreePath, '-b', branchName], {
			cwd: repoPath,
		});
	} catch (e: unknown) {
		const stderr = e instanceof Error && 'stderr' in e ? (e as { stderr: string }).stderr : String(e);
		throw new Error(stderr.trim() || 'Failed to create worktree');
	}

	// Push upstream (non-fatal if it fails)
	try {
		await execFileAsync('git', ['-C', worktreePath, 'push', '-u', 'origin', branchName]);
	} catch {
		// Push failure is not fatal — worktree still works locally
	}

	// Copy .env if it exists in the source repo
	const envSrc = join(repoPath, '.env');
	try {
		await access(envSrc);
		await copyFile(envSrc, join(worktreePath, '.env'));
	} catch {
		// No .env to copy
	}

	const allWorktrees = await listWorktrees(repoPath);
	const created = allWorktrees.find((w) => w.path === worktreePath);
	if (!created) {
		throw new Error('Worktree was created but could not be found in the list');
	}

	return { worktree: created, worktreePath };
}

/**
 * Remove a git worktree and optionally delete its branch.
 */
export async function removeWorktree(repoPath: string, worktreePath: string): Promise<void> {
	// Get the branch name before removing so we can clean it up
	const allWorktrees = await listWorktrees(repoPath);
	const wt = allWorktrees.find((w) => w.path === worktreePath);
	if (!wt) {
		throw new Error('Worktree not found');
	}
	if (wt.isMain) {
		throw new Error('Cannot remove the main worktree');
	}

	try {
		await execFileAsync('git', ['worktree', 'remove', worktreePath, '--force'], {
			cwd: repoPath,
		});
	} catch (e: unknown) {
		const stderr = e instanceof Error && 'stderr' in e ? (e as { stderr: string }).stderr : String(e);
		throw new Error(stderr.trim() || 'Failed to remove worktree');
	}

	// Delete the branch (non-fatal)
	try {
		await execFileAsync('git', ['branch', '-D', wt.branch], { cwd: repoPath });
	} catch {
		// Branch may already be gone or be checked out elsewhere
	}
}
