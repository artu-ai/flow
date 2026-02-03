import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { transitionToInProgress } from '$lib/server/linear';

export const POST: RequestHandler = async ({ request }) => {
	const apiKey = request.headers.get('authorization');
	if (!apiKey) {
		return json({ error: 'Authorization header required' }, { status: 401 });
	}
	const { issueId } = await request.json();
	if (!issueId || typeof issueId !== 'string') {
		return json({ error: 'issueId is required' }, { status: 400 });
	}
	const result = await transitionToInProgress(apiKey, issueId);
	return json(result);
};
