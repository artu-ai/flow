import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CONFIG_DIR = join(homedir(), '.flow');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

interface FlowConfig {
	linear: { apiKey: string | null };
	completion: {
		activeProvider: 'ollama' | 'claude' | null;
		ollama: { url: string; model: string };
		claude: { apiKey: string; model: string };
	};
}

const DEFAULT_CONFIG: FlowConfig = {
	linear: { apiKey: null },
	completion: {
		activeProvider: null,
		ollama: { url: 'http://localhost:11434', model: '' },
		claude: { apiKey: '', model: 'claude-3-5-haiku-20241022' },
	},
};

async function readConfig(): Promise<FlowConfig> {
	try {
		const data = await readFile(CONFIG_PATH, 'utf-8');
		return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
	} catch {
		return { ...DEFAULT_CONFIG };
	}
}

async function writeConfig(config: FlowConfig): Promise<void> {
	await mkdir(CONFIG_DIR, { recursive: true });
	await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
}

export const GET: RequestHandler = async () => {
	const config = await readConfig();
	return json({ ...config, projectRoot: process.env.PROJECT_ROOT || process.cwd() });
};

export const PUT: RequestHandler = async ({ request }) => {
	const incoming = await request.json();
	const existing = await readConfig();

	// Deep merge incoming into existing
	const merged: FlowConfig = {
		linear: { ...existing.linear, ...incoming.linear },
		completion: {
			...existing.completion,
			...incoming.completion,
			ollama: { ...existing.completion.ollama, ...incoming.completion?.ollama },
			claude: { ...existing.completion.claude, ...incoming.completion?.claude },
		},
	};

	await writeConfig(merged);
	return json(merged);
};
