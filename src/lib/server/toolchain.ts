import { access } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

export const execFile = promisify(execFileCb);

export async function fileExists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

/**
 * Walk up from the file's directory to the worktree root, looking for any of
 * the given config file names. Returns the directory that contains a match,
 * or null if none is found.
 */
export async function findConfigDir(
	root: string,
	filePath: string,
	configNames: string[],
): Promise<string | null> {
	const absRoot = resolve(root);
	let dir = dirname(resolve(root, filePath));

	while (dir.startsWith(absRoot)) {
		for (const name of configNames) {
			if (await fileExists(join(dir, name))) return dir;
		}
		const parent = dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}

	return null;
}

export async function findBiomeBin(root: string, filePath: string): Promise<string | null> {
	const configDir = await findConfigDir(root, filePath, ['biome.json', 'biome.jsonc']);
	const searchDirs = configDir ? [configDir, root] : [root];

	for (const dir of searchDirs) {
		const local = join(dir, 'node_modules', '.bin', 'biome');
		if (await fileExists(local)) return local;
	}

	// Fall back to biome on PATH (global install or parent project)
	try {
		const { stdout } = await execFile('which', ['biome']);
		const bin = stdout.trim();
		if (bin) return bin;
	} catch {
		// not on PATH
	}

	return null;
}

export async function findEslintBin(root: string, filePath: string): Promise<string | null> {
	const configDir = await findConfigDir(root, filePath, [
		'eslint.config.js',
		'eslint.config.mjs',
		'eslint.config.cjs',
		'.eslintrc.json',
		'.eslintrc.js',
		'.eslintrc.yml',
	]);
	const searchDirs = configDir ? [configDir, root] : [root];

	for (const dir of searchDirs) {
		const local = join(dir, 'node_modules', '.bin', 'eslint');
		if (await fileExists(local)) return local;
	}

	// Fall back to eslint on PATH
	try {
		const { stdout } = await execFile('which', ['eslint']);
		const bin = stdout.trim();
		if (bin) return bin;
	} catch {
		// not on PATH
	}

	return null;
}

export async function hasBiomeConfig(root: string, filePath: string): Promise<string | null> {
	return findConfigDir(root, filePath, ['biome.json', 'biome.jsonc']);
}

export async function hasEslintConfig(root: string, filePath: string): Promise<string | null> {
	return findConfigDir(root, filePath, [
		'eslint.config.js',
		'eslint.config.mjs',
		'eslint.config.cjs',
		'.eslintrc.json',
		'.eslintrc.js',
		'.eslintrc.yml',
	]);
}

export async function hasRuff(): Promise<boolean> {
	try {
		await execFile('which', ['ruff']);
		return true;
	} catch {
		return false;
	}
}

export async function findRuffBin(root: string, filePath: string): Promise<string | null> {
	const configDir = await findConfigDir(root, filePath, [
		'pyproject.toml',
		'ruff.toml',
		'.ruff.toml',
	]);
	const searchDirs = configDir ? [configDir, root] : [root];

	for (const dir of searchDirs) {
		const local = join(dir, 'node_modules', '.bin', 'ruff');
		if (await fileExists(local)) return local;
	}

	try {
		const { stdout } = await execFile('which', ['ruff']);
		const bin = stdout.trim();
		if (bin) return bin;
	} catch {
		// not on PATH
	}

	return null;
}
