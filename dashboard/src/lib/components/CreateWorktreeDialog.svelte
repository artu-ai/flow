<script lang="ts">
	import * as Command from '$lib/components/ui/command';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as ScrollArea from '$lib/components/ui/scroll-area';
	import { currentWorktree, linearApiKey } from '$lib/stores';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import GitBranchIcon from '@lucide/svelte/icons/git-branch';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { cn } from '$lib/utils';
	import { toast } from 'svelte-sonner';

	interface LinearIssue {
		id: string;
		identifier: string;
		title: string;
		branchName: string;
		state: { name: string; type: string };
		priority: number;
	}

	let {
		open = $bindable(false),
		oncreated,
	}: {
		open: boolean;
		oncreated: (data: { worktreePath: string }) => void;
	} = $props();

	let searchValue = $state('');
	let creating = $state(false);
	let createError = $state('');

	// Branch picker step
	let pendingBranchName = $state('');
	let pendingIssue = $state<LinearIssue | null>(null);
	let pickingSource = $derived(pendingBranchName !== '');

	let availableBranches = $state<{ name: string; current: boolean; remote: boolean }[]>([]);
	let issues = $state<LinearIssue[]>([]);
	let issuesLoading = $state(false);

	async function loadBranches() {
		if (!$currentWorktree) return;
		try {
			const params = new URLSearchParams({ worktree: $currentWorktree.path });
			const res = await fetch(`/api/git/branches?${params}`);
			const data = await res.json();
			availableBranches = data.branches ?? [];
		} catch {
			availableBranches = [];
		}
	}

	// Reset state when dialog opens/closes
	$effect(() => {
		if (open) {
			searchValue = '';
			createError = '';
			pendingBranchName = '';
			pendingIssue = null;
			loadBranches();
			if ($linearApiKey) {
				fetchIssues();
			}
		} else {
			issues = [];
			availableBranches = [];
		}
	});

	async function fetchIssues() {
		if (!$linearApiKey) return;
		issuesLoading = true;
		try {
			const res = await fetch('/api/linear/issues', {
				headers: { Authorization: $linearApiKey },
			});
			const data = await res.json();
			if (res.ok) {
				issues = data.issues;
			}
		} catch {
			// Silently fail — issues section just won't show
		} finally {
			issuesLoading = false;
		}
	}

	function handleSelectCreate() {
		if (!searchValue.trim()) return;
		pendingBranchName = searchValue.trim();
		pendingIssue = null;
	}

	function handleSelectIssue(issue: LinearIssue) {
		pendingBranchName = issue.branchName;
		pendingIssue = issue;
	}

	function handleBack() {
		pendingBranchName = '';
		pendingIssue = null;
		createError = '';
	}

	async function handlePickSourceBranch(source: string) {
		const branchName = pendingBranchName;
		const issue = pendingIssue;

		creating = true;
		createError = '';
		try {
			const payload: Record<string, string> = { branchName, sourceBranch: source };
			const res = await fetch('/api/worktrees', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			const data = await res.json();
			if (!res.ok) {
				createError = data.error || 'Failed to create worktree';
				return;
			}

			// Fire-and-forget Linear transition if this was from an issue
			if (issue && $linearApiKey) {
				fetch('/api/linear/transition', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: $linearApiKey,
					},
					body: JSON.stringify({ issueId: issue.id }),
				}).then(async (r) => {
					const result = await r.json();
					if (result.warning) {
						toast.warning(result.warning);
					}
				}).catch(() => {
					toast.warning('Failed to transition issue to In Progress');
				});
			}

			open = false;
			oncreated({ worktreePath: data.worktreePath });
		} catch (e) {
			createError = e instanceof Error ? e.message : 'An unexpected error occurred';
		} finally {
			creating = false;
			pendingBranchName = '';
			pendingIssue = null;
		}
	}

	// Sort branches so "main" is first
	let sortedBranches = $derived.by(() => {
		const sorted = [...availableBranches];
		sorted.sort((a, b) => {
			if (a.name === 'main') return -1;
			if (b.name === 'main') return 1;
			return a.name.localeCompare(b.name);
		});
		return sorted;
	});

	function stateBadgeClass(type: string): string {
		switch (type) {
			case 'started': return 'bg-amber-500/15 text-amber-400';
			case 'unstarted': return 'bg-muted text-muted-foreground';
			case 'backlog': return 'bg-muted text-muted-foreground';
			default: return 'bg-muted text-muted-foreground';
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="overflow-hidden p-0 sm:max-w-lg" showCloseButton={false}>
		<Dialog.Header class="sr-only">
			<Dialog.Title>Create Worktree</Dialog.Title>
			<Dialog.Description>Create a new worktree from a branch or Linear issue.</Dialog.Description>
		</Dialog.Header>

		{#if pickingSource}
			<Command.Root class="**:data-[slot=command-input-wrapper]:h-12 **:data-command-group:px-2 [&_[data-command-group]:not([hidden])_~[data-command-group]]:pt-0 [&_[data-command-input-wrapper]_svg]:h-5 [&_[data-command-input-wrapper]_svg]:w-5 **:data-command-input:h-12 **:data-command-item:px-2 **:data-command-item:py-3 [&_[data-command-item]_svg]:h-5 [&_[data-command-item]_svg]:w-5">
				<div class="flex items-center gap-2 border-b px-3 h-12">
					<button class="rounded-sm p-1 hover:bg-muted" onclick={handleBack}>
						<ArrowLeftIcon class="h-4 w-4" />
					</button>
					<span class="text-sm">
						Base branch for <span class="font-mono text-muted-foreground">{pendingBranchName}</span>
					</span>
				</div>
				<ScrollArea.Root class="max-h-[300px]">
				<Command.List class="max-h-none overflow-visible">
					<Command.Empty>No branch found.</Command.Empty>
					<Command.Group>
						{#each sortedBranches as branch (branch.name)}
							<Command.Item
								value={branch.name}
								onSelect={() => handlePickSourceBranch(branch.name)}
								disabled={creating}
							>
								<GitBranchIcon class="h-3.5 w-3.5 text-muted-foreground" />
								{branch.name}
								{#if branch.name === 'main'}
									<span class="ml-auto text-xs text-muted-foreground">default</span>
								{/if}
							</Command.Item>
						{/each}
					</Command.Group>
				</Command.List>
				</ScrollArea.Root>
				{#if creating}
					<div class="flex items-center justify-center border-t py-3">
						<LoaderCircleIcon class="h-4 w-4 animate-spin text-muted-foreground" />
						<span class="ml-2 text-sm text-muted-foreground">Creating worktree...</span>
					</div>
				{/if}
				{#if createError}
					<p class="border-t px-4 py-3 text-sm text-destructive">{createError}</p>
				{/if}
			</Command.Root>
		{:else}
			<Command.Root class="**:data-[slot=command-input-wrapper]:h-12 **:data-command-group:px-2 [&_[data-command-group]:not([hidden])_~[data-command-group]]:pt-0 [&_[data-command-input-wrapper]_svg]:h-5 [&_[data-command-input-wrapper]_svg]:w-5 **:data-command-input:h-12 **:data-command-item:px-2 **:data-command-item:py-3 [&_[data-command-item]_svg]:h-5 [&_[data-command-item]_svg]:w-5">
				<Command.Input placeholder="Type a branch name or search issues..." bind:value={searchValue} />
				<ScrollArea.Root class="max-h-[300px]">
				<Command.List class="max-h-none overflow-visible">
					<Command.Empty>No results found.</Command.Empty>
					<Command.Group heading="Actions">
						<Command.Item
							value="create-worktree {searchValue}"
							onSelect={handleSelectCreate}
							disabled={!searchValue.trim() || creating}
						>
							<PlusIcon class="h-4 w-4 text-muted-foreground" />
							{#if searchValue.trim()}
								Create worktree <span class="font-mono text-muted-foreground">"{searchValue.trim()}"</span>
							{:else}
								Create worktree...
							{/if}
						</Command.Item>
					</Command.Group>

					{#if $linearApiKey}
						<Command.Group heading="Assigned Issues">
							{#if issuesLoading}
								<div class="flex items-center justify-center py-4">
									<LoaderCircleIcon class="h-4 w-4 animate-spin text-muted-foreground" />
								</div>
							{:else if issues.length > 0}
								{#each issues as issue}
									<Command.Item
										value="{issue.identifier} {issue.title} {issue.branchName}"
										onSelect={() => handleSelectIssue(issue)}
										disabled={creating}
									>
										<div class="flex min-w-0 flex-1 items-center gap-2">
											<span class="shrink-0 font-mono text-xs text-muted-foreground">{issue.identifier}</span>
											<span class="truncate">{issue.title}</span>
											<span class="ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium {stateBadgeClass(issue.state.type)}">
												{issue.state.name}
											</span>
										</div>
									</Command.Item>
								{/each}
							{:else}
								<p class="px-2 py-4 text-center text-sm text-muted-foreground">No assigned issues</p>
							{/if}
						</Command.Group>
					{/if}

					{#if creating}
						<div class="flex items-center justify-center border-t py-3">
							<LoaderCircleIcon class="h-4 w-4 animate-spin text-muted-foreground" />
							<span class="ml-2 text-sm text-muted-foreground">Creating worktree...</span>
						</div>
					{/if}
					{#if createError}
						<p class="border-t px-4 py-3 text-sm text-destructive">{createError}</p>
					{/if}
				</Command.List>
				</ScrollArea.Root>
			</Command.Root>
		{/if}
	</Dialog.Content>
</Dialog.Root>
