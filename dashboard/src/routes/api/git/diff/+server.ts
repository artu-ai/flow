import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getFileDiff } from '$lib/server/git';

export const GET: RequestHandler = async ({ url }) => {
	const worktree = url.searchParams.get('worktree');
	const file = url.searchParams.get('file');

	if (!worktree || !file) {
		return json({ error: 'worktree and file parameters required' }, { status: 400 });
	}

	try {
		const diff = await getFileDiff(worktree, file);
		return json(diff);
	} catch (e) {
		return json({ error: String(e) }, { status: 500 });
	}
};
