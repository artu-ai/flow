import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateApiKey } from '$lib/server/linear';

export const POST: RequestHandler = async ({ request }) => {
	const { apiKey } = await request.json();
	if (!apiKey || typeof apiKey !== 'string') {
		return json({ valid: false, error: 'API key is required' }, { status: 400 });
	}
	const result = await validateApiKey(apiKey);
	return json(result);
};
