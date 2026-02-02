import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listWorktrees, createWorktree, removeWorktree } from '$lib/server/git';

export const GET: RequestHandler = async ({ url }) => {
	const repoPath = url.searchParams.get('repo') || process.cwd();
	try {
		const worktrees = await listWorktrees(repoPath);
		return json(worktrees);
	} catch (e) {
		return json({ error: String(e) }, { status: 500 });
	}
};

const BRANCH_NAME_RE = /^[a-zA-Z0-9._\-/]+$/;

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const branchName = body.branchName;

	if (!branchName || typeof branchName !== 'string') {
		return json({ error: 'branchName is required' }, { status: 400 });
	}
	if (!BRANCH_NAME_RE.test(branchName)) {
		return json({ error: 'Invalid branch name. Use only letters, numbers, dots, hyphens, underscores, and slashes.' }, { status: 400 });
	}

	try {
		const result = await createWorktree(process.cwd(), branchName);
		return json(result);
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const worktreePath = body.worktreePath;

	if (!worktreePath || typeof worktreePath !== 'string') {
		return json({ error: 'worktreePath is required' }, { status: 400 });
	}

	try {
		await removeWorktree(process.cwd(), worktreePath);
		return json({ ok: true });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
	}
};
