import { readFile } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
import { execFile, hasBiomeConfig, hasRuff, findConfigDir } from './toolchain';

let biomeInstance: any = null;
let biomeReady: Promise<any> | null = null;

function getBiome(): Promise<any> {
	if (!biomeReady) {
		biomeReady = import('@biomejs/js-api/nodejs').then(({ Biome }) => {
			biomeInstance = new Biome();
			return biomeInstance;
		});
	}
	return biomeReady;
}

const biomeProjects = new Map<string, { projectKey: number }>();

async function getBiomeProject(configDir: string): Promise<{ projectKey: number }> {
	const cached = biomeProjects.get(configDir);
	if (cached) return cached;

	const biome = await getBiome();
	const { projectKey } = biome.workspace.openProject({ path: configDir, openUninitialized: true });

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

async function biomeSupportsFormat(projectKey: number, filePath: string): Promise<boolean> {
	const biome = await getBiome();
	try {
		const { featuresSupported } = biome.workspace.fileFeatures({ projectKey, path: filePath, features: ['format'] });
		return featuresSupported.format === 'supported';
	} catch {
		return false;
	}
}

export async function formatContent(
	root: string,
	filePath: string,
	content: string,
	enabledFormatters?: { biome?: boolean },
): Promise<{ formatted: boolean; content?: string }> {
	try {
		// Try biome if the project has a biome config and biome is enabled
		const configDir = enabledFormatters?.biome !== false
			? await findConfigDir(root, filePath, ['biome.json', 'biome.jsonc'])
			: null;
		if (configDir) {
			const { projectKey } = await getBiomeProject(configDir);

			if (await biomeSupportsFormat(projectKey, filePath)) {
				const biome = await getBiome();
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
			}
		}

		// Fall back to ruff for Python files
		if (extname(filePath).toLowerCase() === '.py' && (await hasRuff())) {
			const fullPath = resolve(root, filePath);
			await execFile('ruff', ['format', fullPath]);
			return { formatted: true };
		}

		return { formatted: false };
	} catch (e) {
		console.error('[format]', e);
		biomeProjects.delete(root);
		return { formatted: false };
	}
}
