import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { copyFile, readdir } from 'node:fs/promises';
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
 * Create a new git worktree with a new branch, push upstream, and copy .env* files from source.
 */
export async function createWorktree(
	repoPath: string,
	branchName: string,
	sourceBranch?: string,
	sourceWorktreePath?: string,
): Promise<{ worktree: Worktree; worktreePath: string }> {
	const { stdout: repoRoot } = await execFileAsync('git', ['rev-parse', '--show-toplevel'], { cwd: repoPath });
	const root = repoRoot.trim();
	const dirSuffix = branchName.replace(/\//g, '-');
	const worktreePath = join(dirname(root), basename(root) + '-' + dirSuffix);

	const args = ['worktree', 'add', worktreePath, '-b', branchName];
	if (sourceBranch) {
		args.push(sourceBranch);
	}

	try {
		await execFileAsync('git', args, {
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

	// Copy all .env* files from the source worktree (or repo root)
	const envSourceDir = sourceWorktreePath || repoPath;
	try {
		const entries = await readdir(envSourceDir);
		const envFiles = entries.filter((name) => /^\.env/.test(name));
		await Promise.all(
			envFiles.map((name) => copyFile(join(envSourceDir, name), join(worktreePath, name))),
		);
	} catch {
		// Non-fatal — source dir may not exist or have no .env files
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
export interface Branch {
	name: string;
	current: boolean;
	remote: boolean;
}

/**
 * Stage a single file.
 */
export async function gitStageFile(worktreePath: string, filePath: string): Promise<void> {
	await execFileAsync('git', ['add', '--', filePath], { cwd: worktreePath });
}

/**
 * Stage all changes.
 */
export async function gitStageAll(worktreePath: string): Promise<void> {
	await execFileAsync('git', ['add', '-A'], { cwd: worktreePath });
}

/**
 * Unstage a single file.
 */
export async function gitUnstageFile(worktreePath: string, filePath: string): Promise<void> {
	await execFileAsync('git', ['reset', 'HEAD', '--', filePath], { cwd: worktreePath });
}

/**
 * Discard changes to a file. Uses checkout for tracked files, clean for untracked.
 */
export async function gitDiscardFile(worktreePath: string, filePath: string): Promise<void> {
	const { stdout } = await execFileAsync('git', ['status', '--porcelain', '--', filePath], {
		cwd: worktreePath,
	});
	const line = stdout.trim();
	if (line.startsWith('??')) {
		await execFileAsync('git', ['clean', '-fd', '--', filePath], { cwd: worktreePath });
	} else {
		await execFileAsync('git', ['checkout', '--', filePath], { cwd: worktreePath });
	}
}

/**
 * Create a git commit with the given message.
 */
export async function gitCommit(worktreePath: string, message: string): Promise<string> {
	const { stdout } = await execFileAsync('git', ['commit', '-m', message], { cwd: worktreePath });
	return stdout;
}

/**
 * Merge a branch into the current branch.
 */
export async function gitMerge(worktreePath: string, branch: string): Promise<string> {
	const { stdout } = await execFileAsync('git', ['merge', branch], { cwd: worktreePath });
	return stdout;
}

/**
 * Checkout a branch.
 */
export async function gitCheckout(worktreePath: string, branch: string): Promise<string> {
	const { stdout } = await execFileAsync('git', ['checkout', branch], { cwd: worktreePath });
	return stdout;
}

/**
 * Pull from remote.
 */
export async function gitPull(worktreePath: string): Promise<string> {
	const { stdout } = await execFileAsync('git', ['pull'], { cwd: worktreePath });
	return stdout;
}

/**
 * Push to remote.
 */
export async function gitPush(worktreePath: string): Promise<string> {
	const { stdout } = await execFileAsync('git', ['push'], { cwd: worktreePath });
	return stdout;
}

/**
 * Fetch all remotes.
 */
export async function gitFetch(worktreePath: string): Promise<string> {
	const { stdout } = await execFileAsync('git', ['fetch', '--all'], { cwd: worktreePath });
	return stdout;
}

/**
 * List all local and remote branches.
 */
export async function listBranches(worktreePath: string): Promise<Branch[]> {
	const { stdout } = await execFileAsync('git', ['branch', '-a', '--no-color'], {
		cwd: worktreePath,
	});
	const branches: Branch[] = [];
	for (const line of stdout.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.includes('->')) continue;
		const current = line.startsWith('* ');
		const name = trimmed.replace(/^\* /, '');
		const remote = name.startsWith('remotes/');
		branches.push({
			name: remote ? name.replace(/^remotes\//, '') : name,
			current,
			remote,
		});
	}
	return branches;
}

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
