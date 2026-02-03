import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ptyManager } from '$lib/server/pty';

export const GET: RequestHandler = async () => {
	return json(ptyManager.listSessions());
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();

	// sendBeacon can only POST, so accept _method=DELETE via POST
	if (body._method === 'DELETE') {
		if (body.id) ptyManager.destroy(body.id);
		return json({ ok: true });
	}

	const { worktree } = body;
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

export const DELETE: RequestHandler = async ({ request }) => {
	const { id } = await request.json();
	if (!id) {
		return json({ error: 'id parameter required' }, { status: 400 });
	}
	ptyManager.destroy(id);
	return json({ ok: true });
};
