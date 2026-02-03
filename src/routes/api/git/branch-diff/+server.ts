import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getBranchDiffFiles } from '$lib/server/git';

export const GET: RequestHandler = async ({ url }) => {
	const worktree = url.searchParams.get('worktree');
	if (!worktree) {
		return json({ error: 'worktree parameter required' }, { status: 400 });
	}

	try {
		const files = await getBranchDiffFiles(worktree);
		return json({ files });
	} catch (e) {
		return json({ error: String(e) }, { status: 500 });
	}
};
