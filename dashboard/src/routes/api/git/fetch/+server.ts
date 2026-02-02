import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { gitFetch } from '$lib/server/git';

export const POST: RequestHandler = async ({ request }) => {
	const { worktree } = await request.json();
	if (!worktree) {
		return json({ error: 'worktree parameter required' }, { status: 400 });
	}

	try {
		const output = await gitFetch(worktree);
		return json({ ok: true, output });
	} catch (e) {
		return json({ error: String(e) }, { status: 500 });
	}
};
