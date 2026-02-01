import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listDirectory, readFileContent, writeFileContent, detectLanguage } from '$lib/server/files';

export const GET: RequestHandler = async ({ url }) => {
	const root = url.searchParams.get('root');
	const dir = url.searchParams.get('dir');
	const path = url.searchParams.get('path');

	if (!root) {
		return json({ error: 'root parameter required' }, { status: 400 });
	}

	try {
		if (dir !== null) {
			const entries = await listDirectory(root, dir || '.');
			return json(entries);
		}

		if (path !== null) {
			const content = await readFileContent(root, path);
			const language = detectLanguage(path);
			return json({ content, language, path });
		}

		return json({ error: 'dir or path parameter required' }, { status: 400 });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		const status = message === 'Path traversal not allowed' ? 403 : 500;
		return json({ error: message }, { status });
	}
};

export const PUT: RequestHandler = async ({ url, request }) => {
	const root = url.searchParams.get('root');
	const path = url.searchParams.get('path');

	if (!root || !path) {
		return json({ error: 'root and path parameters required' }, { status: 400 });
	}

	try {
		const { content } = await request.json();
		await writeFileContent(root, path, content);
		return json({ ok: true });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		const status = message === 'Path traversal not allowed' ? 403 : 500;
		return json({ error: message }, { status });
	}
};
