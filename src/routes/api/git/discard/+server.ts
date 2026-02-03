import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { gitDiscardFile } from '$lib/server/git';

export const POST: RequestHandler = async ({ request }) => {
	const { worktree, file } = await request.json();
	if (!worktree || !file) {
		return json({ error: 'worktree and file parameters required' }, { status: 400 });
	}

	try {
		await gitDiscardFile(worktree, file);
		return json({ ok: true });
	} catch (e) {
		return json({ error: String(e) }, { status: 500 });
	}
};
