import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readdir } from 'node:fs/promises';

export const GET: RequestHandler = async ({ url }) => {
	const root = url.searchParams.get('root');

	if (!root) {
		return json({ error: 'root parameter required' }, { status: 400 });
	}

	try {
		const entries = await readdir(root);
		const envFiles = entries.filter((name) => /^\.env/.test(name)).sort();
		return json(envFiles);
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 500 });
	}
};
