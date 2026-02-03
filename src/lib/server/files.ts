import { readdir, readFile, writeFile, stat, mkdir, rename, access, rm } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);

export interface FileEntry {
	name: string;
	type: 'file' | 'directory';
	size: number;
}

/**
 * Validate that a resolved path is within the allowed root.
 * Prevents directory traversal attacks.
 */
function validatePath(root: string, requestedPath: string): string {
	const resolved = resolve(root, requestedPath);
	const rel = relative(root, resolved);
	if (rel.startsWith('..') || resolve(root, rel) !== resolved) {
		throw new Error('Path traversal not allowed');
	}
	return resolved;
}

/**
 * Get names that are gitignored in the given directory.
 */
async function getIgnoredNames(repoRoot: string, dir: string, names: string[]): Promise<Set<string>> {
	if (names.length === 0) return new Set();

	const paths = names.map((name) => (dir === '.' ? name : `${dir}/${name}`));

	try {
		const { stdout } = await execFile('git', ['check-ignore', ...paths], { cwd: repoRoot });
		const ignoredPaths = new Set(stdout.trim().split('\n').filter(Boolean));
		return new Set(names.filter((_name, i) => ignoredPaths.has(paths[i])));
	} catch {
		// git check-ignore exits with code 1 when no files are ignored
		return new Set();
	}
}

/**
 * List directory contents, excluding gitignored files.
 */
export async function listDirectory(root: string, dir: string, options?: { showGitIgnored?: boolean }): Promise<FileEntry[]> {
	const fullPath = validatePath(root, dir);
	const entries = await readdir(fullPath, { withFileTypes: true });

	// Filter dotfiles first (allow all .env* files)
	const visible = entries.filter((e) => !e.name.startsWith('.') || e.name.startsWith('.env'));

	// Filter gitignored files (skip when showGitIgnored is enabled)
	const ignored = options?.showGitIgnored
		? new Set<string>()
		: await getIgnoredNames(root, dir, visible.map((e) => e.name));

	const results: FileEntry[] = [];
	for (const entry of visible) {
		if (ignored.has(entry.name)) continue;

		const type = entry.isDirectory() ? 'directory' : 'file';
		let size = 0;
		if (type === 'file') {
			try {
				const s = await stat(join(fullPath, entry.name));
				size = s.size;
			} catch {
				// ignore
			}
		}
		results.push({ name: entry.name, type, size });
	}

	results.sort((a, b) => {
		if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
		return a.name.localeCompare(b.name);
	});

	return results;
}

/**
 * Read file content.
 */
export async function readFileContent(root: string, filePath: string): Promise<string> {
	const fullPath = validatePath(root, filePath);
	return readFile(fullPath, 'utf-8');
}

/**
 * Write file content.
 */
export async function writeFileContent(root: string, filePath: string, content: string): Promise<void> {
	const fullPath = validatePath(root, filePath);
	await writeFile(fullPath, content, 'utf-8');
}

/**
 * Create an empty file at the given path.
 */
export async function createFile(root: string, filePath: string): Promise<void> {
	const fullPath = validatePath(root, filePath);
	try {
		await access(fullPath);
		throw new Error('File already exists');
	} catch (e) {
		if (e instanceof Error && e.message === 'File already exists') throw e;
	}
	await writeFile(fullPath, '', 'utf-8');
}

/**
 * Create a directory at the given path.
 */
export async function createDirectory(root: string, dirPath: string): Promise<void> {
	const fullPath = validatePath(root, dirPath);
	try {
		await access(fullPath);
		throw new Error('Directory already exists');
	} catch (e) {
		if (e instanceof Error && e.message === 'Directory already exists') throw e;
	}
	await mkdir(fullPath, { recursive: true });
}

/**
 * Rename a file or directory.
 */
export async function renameEntry(root: string, oldPath: string, newPath: string): Promise<void> {
	const fullOld = validatePath(root, oldPath);
	const fullNew = validatePath(root, newPath);
	try {
		await access(fullNew);
		throw new Error('Target already exists');
	} catch (e) {
		if (e instanceof Error && e.message === 'Target already exists') throw e;
	}
	await rename(fullOld, fullNew);
}

/**
 * Delete a file or directory.
 */
export async function deleteEntry(root: string, entryPath: string): Promise<void> {
	const fullPath = validatePath(root, entryPath);
	await rm(fullPath, { recursive: true });
}

/**
 * Detect language from file extension for Monaco editor.
 */
export function detectLanguage(filePath: string): string {
	const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
	const map: Record<string, string> = {
		ts: 'typescript',
		tsx: 'typescript',
		js: 'javascript',
		jsx: 'javascript',
		json: 'json',
		md: 'markdown',
		css: 'css',
		scss: 'scss',
		html: 'html',
		svelte: 'html',
		py: 'python',
		rs: 'rust',
		go: 'go',
		yaml: 'yaml',
		yml: 'yaml',
		toml: 'toml',
		sh: 'shell',
		bash: 'shell',
		sql: 'sql',
		xml: 'xml',
		svg: 'xml',
	};
	return map[ext] ?? 'plaintext';
}
