<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import * as Tabs from '$lib/components/ui/tabs';
	import { Button } from '$lib/components/ui/button/index.js';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import FileTypeIcon from './FileTypeIcon.svelte';
	import { currentWorktree, currentFile, activeView, diffBase, statusColor } from '$lib/stores';
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
							<Sidebar.MenuButton isActive={$currentFile === file.path} class="pe-8 data-[active=true]:font-normal {statusColor(workingFileStatus(file))}" onclick={() => selectWorkingFile(file)}>
								<FileTypeIcon filename={file.path.split('/').pop() ?? file.path} />
								<span>{file.path}</span>
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
							<Sidebar.MenuButton isActive={$currentFile === file.path} class="pe-8 data-[active=true]:font-normal {statusColor(workingFileStatus(file))}" onclick={() => selectWorkingFile(file)}>
								<FileTypeIcon filename={file.path.split('/').pop() ?? file.path} />
								<span>{file.path}</span>
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
