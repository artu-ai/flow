import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listDirectory, readFileContent, writeFileContent, detectLanguage, createFile, createDirectory, renameEntry, deleteEntry } from '$lib/server/files';

export const GET: RequestHandler = async ({ url }) => {
	const root = url.searchParams.get('root');
	const dir = url.searchParams.get('dir');
	const path = url.searchParams.get('path');
	const showGitIgnored = url.searchParams.get('showGitIgnored') === '1';

	if (!root) {
		return json({ error: 'root parameter required' }, { status: 400 });
	}

	try {
		if (dir !== null) {
			const entries = await listDirectory(root, dir || '.', { showGitIgnored });
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

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { action, root, path } = await request.json();
		if (!root || !path || !action) {
			return json({ error: 'action, root, and path required' }, { status: 400 });
		}
		if (action === 'createFile') {
			await createFile(root, path);
		} else if (action === 'createDir') {
			await createDirectory(root, path);
		} else {
			return json({ error: 'Invalid action' }, { status: 400 });
		}
		return json({ ok: true });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		const status = message === 'Path traversal not allowed' ? 403 : 500;
		return json({ error: message }, { status });
	}
};

export const PATCH: RequestHandler = async ({ request }) => {
	try {
		const { root, oldPath, newPath } = await request.json();
		if (!root || !oldPath || !newPath) {
			return json({ error: 'root, oldPath, and newPath required' }, { status: 400 });
		}
		await renameEntry(root, oldPath, newPath);
		return json({ ok: true });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		const status = message === 'Path traversal not allowed' ? 403 : 500;
		return json({ error: message }, { status });
	}
};

export const DELETE: RequestHandler = async ({ request }) => {
	try {
		const { root, path } = await request.json();
		if (!root || !path) {
			return json({ error: 'root and path required' }, { status: 400 });
		}
		await deleteEntry(root, path);
		return json({ ok: true });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		const status = message === 'Path traversal not allowed' ? 403 : 500;
		return json({ error: message }, { status });
	}
};
