import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { gitMerge } from '$lib/server/git';

export const POST: RequestHandler = async ({ request }) => {
	const { worktree, branch } = await request.json();
	if (!worktree || !branch) {
		return json({ error: 'worktree and branch parameters required' }, { status: 400 });
	}

	try {
		const output = await gitMerge(worktree, branch);
		return json({ ok: true, output });
	} catch (e) {
		return json({ error: String(e) }, { status: 500 });
	}
};
