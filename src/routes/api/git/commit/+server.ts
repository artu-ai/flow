import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { gitCommit, gitStageAll } from '$lib/server/git';

export const POST: RequestHandler = async ({ request }) => {
	const { worktree, message, stageAll } = await request.json();
	if (!worktree || !message) {
		return json({ error: 'worktree and message parameters required' }, { status: 400 });
	}

	try {
		if (stageAll) {
			await gitStageAll(worktree);
		}
		const output = await gitCommit(worktree, message);
		return json({ ok: true, output });
	} catch (e) {
		return json({ error: String(e) }, { status: 500 });
	}
};
