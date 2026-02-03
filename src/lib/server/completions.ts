export interface CompletionContext {
	prefix: string;
	suffix: string;
	language: string;
	filename: string;
}

export interface OllamaConfig {
	url: string;
	model: string;
}

export interface ClaudeConfig {
	apiKey: string;
	model: string;
}

export interface CompletionRequest {
	provider: 'ollama' | 'claude';
	providerConfig: OllamaConfig | ClaudeConfig;
	context: CompletionContext;
}

export interface CompletionResult {
	text: string;
}

export async function getCompletion(req: CompletionRequest, signal?: AbortSignal): Promise<CompletionResult> {
	if (req.provider === 'ollama') {
		return getOllamaCompletion(req.providerConfig as OllamaConfig, req.context, signal);
	}
	return getClaudeCompletion(req.providerConfig as ClaudeConfig, req.context, signal);
}

function buildFimPrompt(model: string, ctx: CompletionContext): { prompt: string; raw?: boolean } {
	const name = model.toLowerCase();

	// CodeLlama FIM format
	if (name.includes('codellama') || name.includes('code-llama')) {
		return {
			prompt: `<PRE> ${ctx.prefix} <SUF>${ctx.suffix} <MID>`,
			raw: true,
		};
	}

	// DeepSeek Coder FIM format
	if (name.includes('deepseek')) {
		return {
			prompt: `<｜fim▁begin｜>${ctx.prefix}<｜fim▁hole｜>${ctx.suffix}<｜fim▁end｜>`,
			raw: true,
		};
	}

	// StarCoder / StarCoder2 FIM format
	if (name.includes('starcoder')) {
		return {
			prompt: `<fim_prefix>${ctx.prefix}<fim_suffix>${ctx.suffix}<fim_middle>`,
			raw: true,
		};
	}

	// Qwen2.5-Coder FIM format
	if (name.includes('qwen')) {
		return {
			prompt: `<|fim_prefix|>${ctx.prefix}<|fim_suffix|>${ctx.suffix}<|fim_middle|>`,
			raw: true,
		};
	}

	// Fallback: simple continuation prompt
	return {
		prompt: `Continue this ${ctx.language} code. Only output the code that comes next, no explanation.\n\n${ctx.prefix}`,
	};
}

async function getOllamaCompletion(config: OllamaConfig, ctx: CompletionContext, signal?: AbortSignal): Promise<CompletionResult> {
	const { prompt, raw } = buildFimPrompt(config.model, ctx);

	const res = await fetch(`${config.url}/api/generate`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			model: config.model,
			prompt,
			stream: false,
			raw: raw ?? false,
			options: {
				temperature: 0.1,
				num_predict: 128,
				stop: ['\n\n\n', '<|endoftext|>', '<|file_separator|>', '```'],
			},
		}),
		signal,
	});

	if (!res.ok) {
		const body = await res.text();
		throw new Error(`Ollama error ${res.status}: ${body}`);
	}

	const data = await res.json();
	return { text: cleanCompletion(data.response ?? '') };
}

async function getClaudeCompletion(config: ClaudeConfig, ctx: CompletionContext, signal?: AbortSignal): Promise<CompletionResult> {
	const res = await fetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-api-key': config.apiKey,
			'anthropic-version': '2023-06-01',
		},
		body: JSON.stringify({
			model: config.model,
			max_tokens: 256,
			system: 'You are a code completion engine. Output ONLY the code that should be inserted at the cursor position. No explanations, no markdown, no backticks. Just raw code.',
			messages: [
				{
					role: 'user',
					content: `Complete the ${ctx.language} code at the cursor position marked with <CURSOR>. File: ${ctx.filename}\n\n${ctx.prefix}<CURSOR>${ctx.suffix}`,
				},
			],
		}),
		signal,
	});

	if (!res.ok) {
		const body = await res.text();
		throw new Error(`Claude API error ${res.status}: ${body}`);
	}

	const data = await res.json();
	const text = data.content?.[0]?.text ?? '';
	return { text: cleanCompletion(text) };
}

function cleanCompletion(text: string): string {
	let cleaned = text;
	// Remove leading/trailing backtick blocks if the model wrapped output
	cleaned = cleaned.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '');
	// Remove trailing whitespace-only lines but keep leading whitespace
	cleaned = cleaned.replace(/\n\s*$/, '');
	return cleaned;
}

export async function validateOllama(url: string): Promise<{ valid: boolean; models?: string[]; error?: string }> {
	try {
		const res = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(5000) });
		if (!res.ok) {
			return { valid: false, error: `HTTP ${res.status}` };
		}
		const data = await res.json();
		const models = (data.models ?? []).map((m: { name: string }) => m.name) as string[];
		return { valid: true, models };
	} catch (e) {
		return { valid: false, error: e instanceof Error ? e.message : 'Connection failed' };
	}
}

export async function validateClaude(apiKey: string): Promise<{ valid: boolean; models?: string[]; error?: string }> {
	try {
		// List models to both validate the key and return available models
		const res = await fetch('https://api.anthropic.com/v1/models?limit=100', {
			headers: {
				'x-api-key': apiKey,
				'anthropic-version': '2023-06-01',
			},
			signal: AbortSignal.timeout(10000),
		});
		if (!res.ok) {
			const body = await res.text();
			if (res.status === 401) return { valid: false, error: 'Invalid API key' };
			return { valid: false, error: `API error ${res.status}: ${body}` };
		}
		const data = await res.json();
		const models = (data.data ?? [])
			.map((m: { id: string }) => m.id)
			.sort() as string[];
		return { valid: true, models };
	} catch (e) {
		return { valid: false, error: e instanceof Error ? e.message : 'Validation failed' };
	}
}
