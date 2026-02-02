import { readFile } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
import { execFile, hasBiomeConfig, hasRuff, findConfigDir, BIOME_EXTENSIONS } from './toolchain';

type Formatter = 'biome' | 'ruff' | null;

const formatterCache = new Map<string, Formatter>();

let biomeInstance: any = null;

function getBiome() {
	if (!biomeInstance) {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const { Biome } = require('@biomejs/js-api/nodejs');
		biomeInstance = new Biome();
	}
	return biomeInstance;
}

const biomeProjects = new Map<string, { projectKey: number }>();

async function getBiomeProject(configDir: string): Promise<{ projectKey: number }> {
	const cached = biomeProjects.get(configDir);
	if (cached) return cached;

	const biome = getBiome();
	const { projectKey } = biome.workspace.openProject({ path: configDir, openUninitialized: true });

	// Load the project's biome.json config
	for (const name of ['biome.json', 'biome.jsonc']) {
		try {
			const raw = await readFile(join(configDir, name), 'utf-8');
			const config = JSON.parse(raw);
			delete config.$schema;
			delete config.vcs;
			biome.workspace.updateSettings({ projectKey, configuration: config });
			break;
		} catch {
			continue;
		}
	}

	const entry = { projectKey };
	biomeProjects.set(configDir, entry);
	return entry;
}

export async function detectFormatter(
	root: string,
	filePath: string,
): Promise<Formatter> {
	const ext = extname(filePath).toLowerCase();

	const cached = formatterCache.get(root);
	if (cached !== undefined) {
		if (cached === 'biome' && BIOME_EXTENSIONS.has(ext)) return 'biome';
		if (cached === 'ruff' && ext === '.py') return 'ruff';
		if (cached === null) return null;
		if (cached === 'biome' && ext === '.py') {
			if (await hasRuff()) return 'ruff';
			return null;
		}
		return null;
	}

	if (await hasBiomeConfig(root, filePath)) {
		formatterCache.set(root, 'biome');
		if (BIOME_EXTENSIONS.has(ext)) return 'biome';
		if (ext === '.py' && (await hasRuff())) return 'ruff';
		return null;
	}

	if (ext === '.py' && (await hasRuff())) {
		formatterCache.set(root, 'ruff');
		return 'ruff';
	}

	formatterCache.set(root, null);
	return null;
}

export async function formatContent(
	root: string,
	filePath: string,
	content: string,
): Promise<{ formatted: boolean; content?: string }> {
	const formatter = await detectFormatter(root, filePath);
	if (!formatter) return { formatted: false };

	try {
		if (formatter === 'biome') {
			const configDir = await findConfigDir(root, filePath, ['biome.json', 'biome.jsonc']);
			if (!configDir) return { formatted: false };

			const { projectKey } = await getBiomeProject(configDir);
			const biome = getBiome();

			biome.workspace.openFile({
				projectKey,
				path: filePath,
				content: { type: 'fromClient', content, version: 0 },
			});

			try {
				const result = biome.workspace.formatFile({ projectKey, path: filePath });
				return { formatted: result.code !== content, content: result.code };
			} finally {
				biome.workspace.closeFile({ projectKey, path: filePath });
			}
		} else {
			// Ruff doesn't have a JS API — write to disk, format, read back
			const fullPath = resolve(root, filePath);
			await execFile('ruff', ['format', fullPath]);
			return { formatted: true };
		}
	} catch {
		// Clear caches on error so next save re-detects
		formatterCache.delete(root);
		biomeProjects.delete(root);
		return { formatted: false };
	}
}
