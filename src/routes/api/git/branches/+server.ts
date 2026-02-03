import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listBranches } from '$lib/server/git';

export const GET: RequestHandler = async ({ url }) => {
	const worktree = url.searchParams.get('worktree');
	if (!worktree) {
		return json({ error: 'worktree parameter required' }, { status: 400 });
	}

	try {
		const branches = await listBranches(worktree);
		return json({ branches });
	} catch (e) {
		return json({ error: String(e) }, { status: 500 });
	}
};
