<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import * as Tabs from '$lib/components/ui/tabs';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as ScrollArea from '$lib/components/ui/scroll-area';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import EllipsisVerticalIcon from '@lucide/svelte/icons/ellipsis-vertical';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import MinusIcon from '@lucide/svelte/icons/minus';
	import Undo2Icon from '@lucide/svelte/icons/undo-2';
	import LoaderIcon from '@lucide/svelte/icons/loader';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import GitBranchIcon from '@lucide/svelte/icons/git-branch';
	import FileTypeIcon from './FileTypeIcon.svelte';
	import { currentWorktree, currentFile, activeView, diffBase, statusColor, worktrees } from '$lib/stores';
	import type { GitFileStatus } from '$lib/stores';
	import { onMount } from 'svelte';

	interface ChangedFile {
		path: string;
		status: string;
		staged: string;
	}

	interface BranchFile {
		path: string;
		status: string;
	}

	interface BranchInfo {
		name: string;
		current: boolean;
		remote: boolean;
	}

	type ChangesTab = 'working' | 'branch';
	let activeChangesTab: ChangesTab = $state('working');

	function switchChangesTab(tab: string) {
		activeChangesTab = tab as ChangesTab;
		diffBase.set(tab === 'branch' ? 'main' : 'head');
	}

	let workingFiles: ChangedFile[] = $state([]);
	let branchFiles: BranchFile[] = $state([]);
	let loading = $state(false);

	let stagedFiles = $derived(workingFiles.filter((f) => f.staged !== ' ' && f.staged !== '?'));
	let unstagedFiles = $derived(
		workingFiles.filter((f) => f.status !== ' ' || f.staged === '?')
	);

	// File action loading states
	let actionLoading = $state<string | null>(null);

	// Git command states
	let commitDialogOpen = $state(false);
	let commitMessage = $state('');
	let commitStageAll = $state(false);
	let commitLoading = $state(false);

	let branchDialogOpen = $state(false);
	let branchDialogMode = $state<'merge' | 'checkout'>('merge');
	let branches = $state<BranchInfo[]>([]);
	let branchSearch = $state('');
	let branchLoading = $state(false);

	let pullLoading = $state(false);
	let pushLoading = $state(false);
	let fetchLoading = $state(false);

	// Discard confirmation
	let discardFile = $state<ChangedFile | null>(null);
	let discardDialogOpen = $state(false);

	async function loadWorkingChanges() {
		if (!$currentWorktree) return;
		const params = new URLSearchParams({ worktree: $currentWorktree.path });
		const res = await fetch(`/api/git/status?${params}`);
		const data = await res.json();
		workingFiles = data.files || [];
	}

	async function loadBranchChanges() {
		if (!$currentWorktree) return;
		const params = new URLSearchParams({ worktree: $currentWorktree.path });
		const res = await fetch(`/api/git/branch-diff?${params}`);
		const data = await res.json();
		branchFiles = data.files || [];
	}

	async function refresh() {
		loading = true;
		await Promise.all([loadWorkingChanges(), loadBranchChanges()]);
		loading = false;
	}

	function selectWorkingFile(file: ChangedFile) {
		currentFile.set(file.path);
		diffBase.set('head');
		activeView.set('diff');
	}

	function selectBranchFile(file: BranchFile) {
		currentFile.set(file.path);
		diffBase.set('main');
		activeView.set('diff');
	}

	function workingStatusLabel(file: ChangedFile): string {
		if (file.staged === '?' || file.status === '?') return 'U';
		if (file.staged === 'A' || file.status === 'A') return 'A';
		if (file.staged === 'D' || file.status === 'D') return 'D';
		return 'M';
	}

	function branchStatusLabel(status: string): string {
		if (status === 'A') return 'A';
		if (status === 'D') return 'D';
		if (status.startsWith('R')) return 'R';
		return 'M';
	}

	function workingFileStatus(file: ChangedFile): GitFileStatus {
		if (file.staged === '?' || file.status === '?') return 'untracked';
		if (file.staged === 'A' || file.status === 'A') return 'added';
		if (file.staged === 'D' || file.status === 'D') return 'deleted';
		return 'modified';
	}

	function branchFileStatus(status: string): GitFileStatus {
		if (status === 'A') return 'added';
		if (status === 'D') return 'deleted';
		if (status.startsWith('R')) return 'renamed';
		return 'modified';
	}

	// File actions
	async function stageFile(file: ChangedFile) {
		if (!$currentWorktree) return;
		actionLoading = file.path;
		try {
			await fetch('/api/git/stage', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ worktree: $currentWorktree.path, file: file.path }),
			});
			await refresh();
		} finally {
			actionLoading = null;
		}
	}

	async function unstageFile(file: ChangedFile) {
		if (!$currentWorktree) return;
		actionLoading = file.path;
		try {
			await fetch('/api/git/unstage', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ worktree: $currentWorktree.path, file: file.path }),
			});
			await refresh();
		} finally {
			actionLoading = null;
		}
	}

	function confirmDiscard(file: ChangedFile) {
		discardFile = file;
		discardDialogOpen = true;
	}

	async function executeDiscard() {
		if (!$currentWorktree || !discardFile) return;
		actionLoading = discardFile.path;
		discardDialogOpen = false;
		try {
			await fetch('/api/git/discard', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ worktree: $currentWorktree.path, file: discardFile.path }),
			});
			await refresh();
		} finally {
			actionLoading = null;
			discardFile = null;
		}
	}

	// Git commands
	function openCommitDialog() {
		commitMessage = '';
		commitStageAll = stagedFiles.length === 0;
		commitDialogOpen = true;
	}

	async function executeCommit() {
		if (!$currentWorktree || !commitMessage.trim()) return;
		commitLoading = true;
		try {
			const res = await fetch('/api/git/commit', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					worktree: $currentWorktree.path,
					message: commitMessage.trim(),
					stageAll: commitStageAll,
				}),
			});
			const data = await res.json();
			if (data.ok) {
				commitDialogOpen = false;
				commitMessage = '';
				await refresh();
			}
		} finally {
			commitLoading = false;
		}
	}

	async function openBranchDialog(mode: 'merge' | 'checkout') {
		branchDialogMode = mode;
		branchSearch = '';
		branches = [];
		branchDialogOpen = true;
		if (!$currentWorktree) return;
		branchLoading = true;
		try {
			const params = new URLSearchParams({ worktree: $currentWorktree.path });
			const res = await fetch(`/api/git/branches?${params}`);
			const data = await res.json();
			branches = data.branches || [];
		} finally {
			branchLoading = false;
		}
	}

	let localBranches = $derived(branches.filter((b) => !b.remote));
	let remoteBranches = $derived(branches.filter((b) => b.remote));

	async function selectBranch(branchName: string) {
		if (!$currentWorktree) return;
		branchLoading = true;
		const endpoint = branchDialogMode === 'merge' ? '/api/git/merge' : '/api/git/checkout';
		try {
			const res = await fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ worktree: $currentWorktree.path, branch: branchName }),
			});
			const data = await res.json();
			if (data.ok) {
				branchDialogOpen = false;
				await refresh();
				// After checkout, refresh worktree list to update header tabs
				if (branchDialogMode === 'checkout') {
					const listRes = await fetch('/api/worktrees');
					const allWorktrees = await listRes.json();
					worktrees.set(allWorktrees);
					const updated = allWorktrees.find((w: { path: string }) => w.path === $currentWorktree?.path);
					if (updated) {
						currentWorktree.set(updated);
					}
				}
			}
		} finally {
			branchLoading = false;
		}
	}

	async function executePull() {
		if (!$currentWorktree) return;
		pullLoading = true;
		try {
			await fetch('/api/git/pull', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ worktree: $currentWorktree.path }),
			});
			await refresh();
		} finally {
			pullLoading = false;
		}
	}

	async function executePush() {
		if (!$currentWorktree) return;
		pushLoading = true;
		try {
			await fetch('/api/git/push', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ worktree: $currentWorktree.path }),
			});
		} finally {
			pushLoading = false;
		}
	}

	async function executeFetch() {
		if (!$currentWorktree) return;
		fetchLoading = true;
		try {
			await fetch('/api/git/fetch', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ worktree: $currentWorktree.path }),
			});
			await refresh();
		} finally {
			fetchLoading = false;
		}
	}

	function handleVisibilityChange() {
		if (document.visibilityState === 'visible') {
			refresh();
		}
	}

	onMount(() => {
		document.addEventListener('visibilitychange', handleVisibilityChange);
		return () => {
			document.removeEventListener('visibilitychange', handleVisibilityChange);
		};
	});

	$effect(() => {
		if ($currentWorktree) {
			refresh();
		}
	});
</script>

<div class="flex items-center gap-1 border-b border-border px-2 py-1">
	<Tabs.Root bind:value={activeChangesTab} onValueChange={switchChangesTab} class="flex-1">
		<Tabs.List class="h-7 w-full">
			<Tabs.Trigger value="working" class="h-6 flex-1 text-xs">Working</Tabs.Trigger>
			<Tabs.Trigger value="branch" class="h-6 flex-1 text-xs">Branch</Tabs.Trigger>
		</Tabs.List>
	</Tabs.Root>
	<Button variant="ghost" size="icon" class="h-7 w-7 shrink-0" onclick={refresh} disabled={loading}>
		<RefreshCwIcon class="size-3.5 {loading ? 'animate-spin' : ''}" />
	</Button>
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<Button variant="ghost" size="icon" class="h-7 w-7 shrink-0" {...props}>
					<EllipsisVerticalIcon class="size-3.5" />
				</Button>
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end" class="w-40">
			<DropdownMenu.Item onclick={openCommitDialog}>Commit</DropdownMenu.Item>
			<DropdownMenu.Item onclick={() => openBranchDialog('merge')}>Merge</DropdownMenu.Item>
			<DropdownMenu.Item onclick={() => openBranchDialog('checkout')}>Checkout</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Item onclick={executePull} disabled={pullLoading}>
				{pullLoading ? 'Pulling...' : 'Pull'}
			</DropdownMenu.Item>
			<DropdownMenu.Item onclick={executePush} disabled={pushLoading}>
				{pushLoading ? 'Pushing...' : 'Push'}
			</DropdownMenu.Item>
			<DropdownMenu.Item onclick={executeFetch} disabled={fetchLoading}>
				{fetchLoading ? 'Fetching...' : 'Fetch'}
			</DropdownMenu.Item>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
</div>

{#if activeChangesTab === 'working'}
	<Sidebar.Group>
		<Sidebar.GroupContent>
			<Sidebar.Menu>
				{#if stagedFiles.length > 0}
					<Sidebar.GroupLabel class="text-[10px] uppercase tracking-wider text-muted-foreground/70 px-2 py-1">
						Staged
					</Sidebar.GroupLabel>
					{#each stagedFiles as file}
						<Sidebar.MenuItem>
							<Sidebar.MenuButton isActive={$currentFile === file.path} class="group/file pe-8 data-[active=true]:font-normal {statusColor(workingFileStatus(file))}" onclick={() => selectWorkingFile(file)}>
								<FileTypeIcon filename={file.path.split('/').pop() ?? file.path} />
								<span class="truncate group-hover/file:me-5">{file.path}</span>
								<span class="absolute right-6 flex opacity-0 group-hover/file:opacity-100 transition-opacity">
									{#if actionLoading === file.path}
										<LoaderIcon class="size-4 animate-spin text-muted-foreground" />
									{:else}
										<button
											type="button"
											class="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted-foreground/20"
											onclick={(e) => { e.stopPropagation(); unstageFile(file); }}
											title="Unstage"
										>
											<MinusIcon class="size-4" />
										</button>
									{/if}
								</span>
							</Sidebar.MenuButton>
							<Sidebar.MenuBadge class={statusColor(workingFileStatus(file))}>{workingStatusLabel(file)}</Sidebar.MenuBadge>
						</Sidebar.MenuItem>
					{/each}
				{/if}
				{#if unstagedFiles.length > 0}
					<Sidebar.GroupLabel class="text-[10px] uppercase tracking-wider text-muted-foreground/70 px-2 py-1">
						Unstaged
					</Sidebar.GroupLabel>
					{#each unstagedFiles as file}
						<Sidebar.MenuItem>
							<Sidebar.MenuButton isActive={$currentFile === file.path} class="group/file pe-8 data-[active=true]:font-normal {statusColor(workingFileStatus(file))}" onclick={() => selectWorkingFile(file)}>
								<FileTypeIcon filename={file.path.split('/').pop() ?? file.path} />
								<span class="truncate group-hover/file:me-10">{file.path}</span>
								<span class="absolute right-6 flex gap-0.5 opacity-0 group-hover/file:opacity-100 transition-opacity">
									{#if actionLoading === file.path}
										<LoaderIcon class="size-4 animate-spin text-muted-foreground" />
									{:else}
										<button
											type="button"
											class="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted-foreground/20"
											onclick={(e) => { e.stopPropagation(); confirmDiscard(file); }}
											title="Discard changes"
										>
											<Undo2Icon class="size-4" />
										</button>
										<button
											type="button"
											class="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted-foreground/20"
											onclick={(e) => { e.stopPropagation(); stageFile(file); }}
											title="Stage"
										>
											<PlusIcon class="size-4" />
										</button>
									{/if}
								</span>
							</Sidebar.MenuButton>
							<Sidebar.MenuBadge class={statusColor(workingFileStatus(file))}>{workingStatusLabel(file)}</Sidebar.MenuBadge>
						</Sidebar.MenuItem>
					{/each}
				{/if}
				{#if workingFiles.length === 0}
					<div class="px-2 py-4 text-center text-xs text-muted-foreground">No working tree changes</div>
				{/if}
			</Sidebar.Menu>
		</Sidebar.GroupContent>
	</Sidebar.Group>
{:else}
	<Sidebar.Group>
		<Sidebar.GroupContent>
			<Sidebar.Menu>
				{#each branchFiles as file}
					<Sidebar.MenuItem>
						<Sidebar.MenuButton isActive={$currentFile === file.path} class="pe-8 data-[active=true]:font-normal {statusColor(branchFileStatus(file.status))}" onclick={() => selectBranchFile(file)}>
							<FileTypeIcon filename={file.path.split('/').pop() ?? file.path} />
							<span>{file.path}</span>
						</Sidebar.MenuButton>
						<Sidebar.MenuBadge class={statusColor(branchFileStatus(file.status))}>{branchStatusLabel(file.status)}</Sidebar.MenuBadge>
					</Sidebar.MenuItem>
				{/each}
				{#if branchFiles.length === 0}
					<div class="px-2 py-4 text-center text-xs text-muted-foreground">No changes from main</div>
				{/if}
			</Sidebar.Menu>
		</Sidebar.GroupContent>
	</Sidebar.Group>
{/if}

<!-- Commit Dialog -->
<Dialog.Root bind:open={commitDialogOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Commit</Dialog.Title>
			<Dialog.Description>
				{#if stagedFiles.length > 0 && !commitStageAll}
					{stagedFiles.length} staged file{stagedFiles.length === 1 ? '' : 's'} will be committed.
				{:else}
					All changes will be staged and committed.
				{/if}
			</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-3">
			<Textarea
				bind:value={commitMessage}
				placeholder="Commit message..."
				rows={3}
				class="resize-none"
				onkeydown={(e: KeyboardEvent) => {
					if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
						executeCommit();
					}
				}}
			/>
			{#if stagedFiles.length > 0}
				<label class="flex items-center gap-2 text-sm">
					<input type="checkbox" bind:checked={commitStageAll} class="rounded" />
					Stage all changes before committing
				</label>
			{/if}
		</div>
		<Dialog.Footer>
			<Button variant="ghost" onclick={() => (commitDialogOpen = false)}>Cancel</Button>
			<Button onclick={executeCommit} disabled={commitLoading || !commitMessage.trim()}>
				{#if commitLoading}
					<LoaderIcon class="mr-2 size-4 animate-spin" />
				{/if}
				Commit
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Branch Dialog (Merge / Checkout) -->
<Dialog.Root bind:open={branchDialogOpen}>
	<Dialog.Content class="overflow-hidden p-0 sm:max-w-lg" showCloseButton={false}>
		<Dialog.Header class="sr-only">
			<Dialog.Title>{branchDialogMode === 'merge' ? 'Merge Branch' : 'Checkout Branch'}</Dialog.Title>
			<Dialog.Description>
				{branchDialogMode === 'merge' ? 'Select a branch to merge into the current branch.' : 'Select a branch to check out.'}
			</Dialog.Description>
		</Dialog.Header>
		<Command.Root class="**:data-[slot=command-input-wrapper]:h-12 **:data-command-group:px-2 [&_[data-command-group]:not([hidden])_~[data-command-group]]:pt-0 [&_[data-command-input-wrapper]_svg]:h-5 [&_[data-command-input-wrapper]_svg]:w-5 **:data-command-input:h-12 **:data-command-item:px-2 **:data-command-item:py-3 [&_[data-command-item]_svg]:h-5 [&_[data-command-item]_svg]:w-5" shouldFilter={true}>
			<Command.Input placeholder="Search branches..." bind:value={branchSearch} />
			<ScrollArea.Root class="max-h-[300px]">
			<Command.List class="max-h-none overflow-visible">
				<Command.Empty>
					{branchLoading ? 'Loading branches...' : 'No branches found.'}
				</Command.Empty>
				{#if localBranches.length > 0}
					<Command.Group heading="Local">
						{#each localBranches as branch}
							<Command.Item
								value={branch.name}
								onSelect={() => selectBranch(branch.name)}
								disabled={branch.current}
							>
								<GitBranchIcon class="h-3.5 w-3.5 text-muted-foreground" />
								{branch.name}
								{#if branch.current}
									<span class="ml-auto text-xs text-muted-foreground">current</span>
								{/if}
							</Command.Item>
						{/each}
					</Command.Group>
				{/if}
				{#if remoteBranches.length > 0}
					<Command.Group heading="Remote">
						{#each remoteBranches as branch}
							<Command.Item
								value={branch.name}
								onSelect={() => selectBranch(branch.name)}
							>
								<GitBranchIcon class="h-3.5 w-3.5 text-muted-foreground" />
								{branch.name}
							</Command.Item>
						{/each}
					</Command.Group>
				{/if}
			</Command.List>
			</ScrollArea.Root>
			{#if branchLoading}
				<div class="flex items-center justify-center border-t py-3">
					<LoaderCircleIcon class="h-4 w-4 animate-spin text-muted-foreground" />
					<span class="ml-2 text-sm text-muted-foreground">Loading branches...</span>
				</div>
			{/if}
		</Command.Root>
	</Dialog.Content>
</Dialog.Root>

<!-- Discard Confirmation -->
<AlertDialog.Root bind:open={discardDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Discard Changes</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to discard changes to <code class="text-xs bg-muted px-1 py-0.5 rounded">{discardFile?.path}</code>? This cannot be undone.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action onclick={executeDiscard}>Discard</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
