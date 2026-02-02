import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import {
	execFile,
	findBiomeBin,
	findEslintBin,
	findRuffBin,
	hasBiomeConfig,
	hasEslintConfig,
	hasRuff,
} from './toolchain';

export interface LintDiagnostic {
	line: number;
	column: number;
	endLine: number;
	endColumn: number;
	message: string;
	severity: 'error' | 'warning' | 'info';
	source: string;
	code?: string;
}

type Linter = 'biome' | 'eslint' | 'ruff';

interface LinterInfo {
	linter: Linter;
	configDir: string | null;
}

interface ToolchainCache {
	biomeDir: string | null;
	eslintDir: string | null;
	hasRuff: boolean;
}

const toolchainCache = new Map<string, ToolchainCache>();

async function getToolchain(root: string, filePath: string): Promise<ToolchainCache> {
	let cached = toolchainCache.get(root);
	if (!cached) {
		const [biomeDir, eslintDir, ruffAvailable] = await Promise.all([
			hasBiomeConfig(root, filePath),
			hasEslintConfig(root, filePath),
			hasRuff(),
		]);
		cached = { biomeDir, eslintDir, hasRuff: ruffAvailable };
		toolchainCache.set(root, cached);
	}
	return cached;
}

/** Returns all configured linters — each linter decides if it applies to the file. */
async function detectLinters(
	root: string,
	filePath: string,
): Promise<LinterInfo[]> {
	const tc = await getToolchain(root, filePath);
	const linters: LinterInfo[] = [];

	if (tc.biomeDir) {
		linters.push({ linter: 'biome', configDir: tc.biomeDir });
	}
	if (tc.eslintDir) {
		linters.push({ linter: 'eslint', configDir: tc.eslintDir });
	}
	if (tc.hasRuff) {
		linters.push({ linter: 'ruff', configDir: null });
	}

	return linters;
}

/** Convert a byte offset to 1-based line and column using file content */
function byteOffsetToLineCol(
	content: string,
	byteOffset: number,
): { line: number; column: number } {
	const bytes = Buffer.from(content);
	const prefix = bytes.subarray(0, byteOffset).toString();
	const lines = prefix.split('\n');
	return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

function parseBiomeOutput(
	stdout: string,
	content: string,
): LintDiagnostic[] {
	const diagnostics: LintDiagnostic[] = [];
	try {
		const parsed = JSON.parse(stdout);
		const items = parsed.diagnostics ?? [];
		for (const d of items) {
			const severity =
				d.severity === 'error'
					? 'error'
					: d.severity === 'warning'
						? 'warning'
						: 'info';
			const span = d.location?.span;
			let line = 1,
				column = 1,
				endLine = 1,
				endColumn = 1;
			if (span) {
				const start = byteOffsetToLineCol(content, span[0]);
				const end = byteOffsetToLineCol(content, span[1]);
				line = start.line;
				column = start.column;
				endLine = end.line;
				endColumn = end.column;
			}
			diagnostics.push({
				line,
				column,
				endLine,
				endColumn,
				message: d.description ?? d.message ?? 'Unknown lint error',
				severity,
				source: 'biome',
				code: d.category,
			});
		}
	} catch {
		// Malformed output — return nothing
	}
	return diagnostics;
}

/** Sentinel returned when ESLint has no config for the file */
const ESLINT_NO_CONFIG = Symbol('eslint-no-config');

function parseEslintOutput(stdout: string): LintDiagnostic[] | typeof ESLINT_NO_CONFIG {
	const diagnostics: LintDiagnostic[] = [];
	try {
		const parsed = JSON.parse(stdout);
		for (const file of parsed) {
			for (const msg of file.messages ?? []) {
				if (msg.fatal && !msg.ruleId) return ESLINT_NO_CONFIG;
				diagnostics.push({
					line: msg.line ?? 1,
					column: msg.column ?? 1,
					endLine: msg.endLine ?? msg.line ?? 1,
					endColumn: msg.endColumn ?? msg.column ?? 1,
					message: msg.message ?? 'Unknown lint error',
					severity: msg.severity === 2 ? 'error' : 'warning',
					source: 'eslint',
					code: msg.ruleId ?? undefined,
				});
			}
		}
	} catch {
		// Malformed output
	}
	return diagnostics;
}

function parseRuffOutput(stdout: string): LintDiagnostic[] {
	const diagnostics: LintDiagnostic[] = [];
	try {
		const parsed = JSON.parse(stdout);
		for (const d of parsed) {
			const loc = d.location ?? {};
			const endLoc = d.end_location ?? loc;
			diagnostics.push({
				line: loc.row ?? 1,
				column: loc.column ?? 1,
				endLine: endLoc.row ?? loc.row ?? 1,
				endColumn: endLoc.column ?? loc.column ?? 1,
				message: d.message ?? 'Unknown lint error',
				severity: d.type === 'E' ? 'error' : 'warning',
				source: 'ruff',
				code: d.code ?? undefined,
			});
		}
	} catch {
		// Malformed output
	}
	return diagnostics;
}

async function runBiome(
	root: string,
	filePath: string,
	fullPath: string,
	configDir: string | null,
): Promise<LintDiagnostic[]> {
	const bin = await findBiomeBin(root, filePath);
	if (!bin) return [];
	let stdout = '';
	try {
		const result = await execFile(
			bin,
			['lint', '--reporter=json', fullPath],
			{ cwd: configDir ?? root },
		);
		stdout = result.stdout;
	} catch (e: any) {
		stdout = e.stdout ?? '';
	}
	const content = await readFile(fullPath, 'utf-8');
	return parseBiomeOutput(stdout, content);
}

/** Extensions that ESLint reported "no matching config" for, per configDir */
const eslintSkipExtensions = new Map<string, Set<string>>();

async function runEslint(
	root: string,
	filePath: string,
	fullPath: string,
	configDir: string | null,
): Promise<LintDiagnostic[]> {
	const cwd = configDir ?? root;
	const ext = extname(fullPath).toLowerCase();

	const skipped = eslintSkipExtensions.get(cwd);
	if (skipped?.has(ext)) return [];

	const bin = await findEslintBin(root, filePath);
	if (!bin) return [];

	let stdout = '';
	try {
		const result = await execFile(
			bin,
			['--no-warn-ignored', '--format=json', fullPath],
			{ cwd },
		);
		stdout = result.stdout;
	} catch (e: any) {
		stdout = e.stdout ?? '';
	}

	const result = parseEslintOutput(stdout);
	if (result === ESLINT_NO_CONFIG) {
		if (!eslintSkipExtensions.has(cwd)) {
			eslintSkipExtensions.set(cwd, new Set());
		}
		eslintSkipExtensions.get(cwd)!.add(ext);
		return [];
	}
	return result;
}

async function runRuff(
	root: string,
	filePath: string,
	fullPath: string,
): Promise<LintDiagnostic[]> {
	const bin = await findRuffBin(root, filePath);
	if (!bin) return [];

	let stdout = '';
	try {
		const result = await execFile(bin, [
			'check',
			'--output-format=json',
			fullPath,
		]);
		stdout = result.stdout;
	} catch (e: any) {
		stdout = e.stdout ?? '';
	}
	return parseRuffOutput(stdout);
}

export async function lintFile(
	root: string,
	filePath: string,
	enabledLinters?: { biome?: boolean; eslint?: boolean; ruff?: boolean },
): Promise<LintDiagnostic[]> {
	let linters = await detectLinters(root, filePath);
	if (enabledLinters) {
		linters = linters.filter(({ linter }) => enabledLinters[linter] !== false);
	}
	if (linters.length === 0) return [];

	const fullPath = resolve(root, filePath);

	const results = await Promise.all(
		linters.map(({ linter, configDir }) => {
			try {
				if (linter === 'biome') return runBiome(root, filePath, fullPath, configDir);
				if (linter === 'eslint') return runEslint(root, filePath, fullPath, configDir);
				if (linter === 'ruff') return runRuff(root, filePath, fullPath);
			} catch {
				// Binary not found or other execution failure
			}
			return Promise.resolve([] as LintDiagnostic[]);
		}),
	);

	return results.flat();
}
