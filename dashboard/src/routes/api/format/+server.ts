import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { formatContent } from '$lib/server/format';

export const POST: RequestHandler = async ({ request }) => {
	const { root, path, content } = await request.json();

	if (!root || !path || content == null) {
		return json({ error: 'root, path, and content required' }, { status: 400 });
	}

	try {
		return json(await formatContent(root, path, content));
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 500 });
	}
};
