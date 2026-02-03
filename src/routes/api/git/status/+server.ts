import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStatus } from '$lib/server/git';

export const GET: RequestHandler = async ({ url }) => {
	const worktree = url.searchParams.get('worktree');
	if (!worktree) {
		return json({ error: 'worktree parameter required' }, { status: 400 });
	}

	try {
		const status = await getStatus(worktree);
		return json(status);
	} catch (e) {
		return json({ error: String(e) }, { status: 500 });
	}
};
