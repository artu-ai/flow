import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateOllama, validateClaude } from '$lib/server/completions';

export const POST: RequestHandler = async ({ request }) => {
	const { provider, config } = await request.json();
	if (!provider || !config) {
		return json({ valid: false, error: 'provider and config are required' }, { status: 400 });
	}
	try {
		if (provider === 'ollama') {
			const result = await validateOllama(config.url);
			return json(result);
		}
		if (provider === 'claude') {
			const result = await validateClaude(config.apiKey);
			return json(result);
		}
		return json({ valid: false, error: `Unknown provider: ${provider}` }, { status: 400 });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ valid: false, error: message }, { status: 500 });
	}
};
