import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAssignedIssues } from '$lib/server/linear';

export const GET: RequestHandler = async ({ request }) => {
	const apiKey = request.headers.get('authorization');
	if (!apiKey) {
		return json({ error: 'Authorization header required' }, { status: 401 });
	}
	try {
		const issues = await getAssignedIssues(apiKey);
		return json({ issues });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
	}
};
