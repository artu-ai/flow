import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listWorktrees } from '$lib/server/git';

export const GET: RequestHandler = async ({ url }) => {
	const repoPath = url.searchParams.get('repo') || process.cwd();
	try {
		const worktrees = await listWorktrees(repoPath);
		return json(worktrees);
	} catch (e) {
		return json({ error: String(e) }, { status: 500 });
	}
};
