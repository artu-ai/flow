import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { lintFile } from '$lib/server/lint';

export const POST: RequestHandler = async ({ request }) => {
	const { root, path } = await request.json();

	if (!root || !path) {
		return json({ error: 'root and path required' }, { status: 400 });
	}

	try {
		const diagnostics = await lintFile(root, path);
		return json({ diagnostics });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 500 });
	}
};
