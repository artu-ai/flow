import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ptyManager } from '$lib/server/pty';

export const GET: RequestHandler = async () => {
	return json(ptyManager.listSessions());
};

export const POST: RequestHandler = async ({ request }) => {
	const { worktree } = await request.json();
	if (!worktree) {
		return json({ error: 'worktree parameter required' }, { status: 400 });
	}

	try {
		const session = await ptyManager.createSession(worktree);
		return json({ id: session.id, worktree: session.worktree, createdAt: session.createdAt.toISOString() });
	} catch (e) {
		return json({ error: String(e) }, { status: 500 });
	}
};
