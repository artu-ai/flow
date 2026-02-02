import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCompletion } from '$lib/server/completions';

export const POST: RequestHandler = async ({ request }) => {
	const { provider, providerConfig, context } = await request.json();
	if (!provider || !providerConfig || !context) {
		return json({ error: 'provider, providerConfig, and context are required' }, { status: 400 });
	}
	try {
		const result = await getCompletion({ provider, providerConfig, context });
		return json(result);
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 500 });
	}
};
