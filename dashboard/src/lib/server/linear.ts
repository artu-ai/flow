import { LinearClient } from '@linear/sdk';

export interface LinearIssue {
	id: string;
	identifier: string;
	title: string;
	branchName: string;
	state: { name: string; type: string };
	priority: number;
}

export async function validateApiKey(apiKey: string): Promise<{ valid: boolean; name?: string; email?: string }> {
	try {
		const client = new LinearClient({ apiKey });
		const viewer = await client.viewer;
		return { valid: true, name: viewer.name, email: viewer.email ?? undefined };
	} catch {
		return { valid: false };
	}
}

export async function getAssignedIssues(apiKey: string): Promise<LinearIssue[]> {
	const client = new LinearClient({ apiKey });
	const me = await client.viewer;
	const assigned = await me.assignedIssues({
		filter: {
			state: { type: { nin: ['completed', 'canceled'] } },
		},
		first: 50,
	});

	const issues: LinearIssue[] = [];
	for (const issue of assigned.nodes) {
		const branchName = await issue.branchName;
		if (!branchName) continue;
		const state = await issue.state;
		issues.push({
			id: issue.id,
			identifier: issue.identifier,
			title: issue.title,
			branchName,
			state: state ? { name: state.name, type: state.type } : { name: 'Unknown', type: 'unstarted' },
			priority: issue.priority,
		});
	}

	return issues;
}

export async function transitionToInProgress(apiKey: string, issueId: string): Promise<{ ok: boolean; warning?: string }> {
	try {
		const client = new LinearClient({ apiKey });
		const issue = await client.issue(issueId);
		const team = await issue.team;
		if (!team) {
			return { ok: false, warning: 'Could not find team for issue' };
		}
		const states = await team.states();
		const inProgress = states.nodes.find(
			(s) => s.type === 'started' && s.name.toLowerCase().includes('progress'),
		);
		if (!inProgress) {
			return { ok: true, warning: 'No "In Progress" state found — issue was not transitioned' };
		}
		await client.updateIssue(issueId, { stateId: inProgress.id });
		return { ok: true };
	} catch (e) {
		return { ok: false, warning: e instanceof Error ? e.message : String(e) };
	}
}
