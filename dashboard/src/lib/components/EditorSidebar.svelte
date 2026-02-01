<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import FileIcon from '@lucide/svelte/icons/file';
	import FolderTreeIcon from '@lucide/svelte/icons/folder-tree';
	import GitBranchIcon from '@lucide/svelte/icons/git-branch';
	import type { ComponentProps } from 'svelte';
	import { currentWorktree, currentFile, activeView } from '$lib/stores';
	import type { FileEntry } from '$lib/stores';
	import LazyDir from './LazyDir.svelte';

	let { ref = $bindable(null), ...restProps }: ComponentProps<typeof Sidebar.Root> = $props();

	type SidebarTab = 'files' | 'changes';
	let activeTab: SidebarTab = $state('files');

	interface ChangedFile {
		path: string;
		status: string;
		staged: string;
	}

	let changes: ChangedFile[] = $state([]);
	let rootEntries: FileEntry[] = $state([]);

	async function loadChanges() {
		if (!$currentWorktree) return;
		const params = new URLSearchParams({ worktree: $currentWorktree.path });
		const res = await fetch(`/api/git/status?${params}`);
		const data = await res.json();
		changes = data.files || [];
	}

	async function loadRootEntries() {
		if (!$currentWorktree) return;
		const params = new URLSearchParams({ root: $currentWorktree.path, dir: '.' });
		const res = await fetch(`/api/files?${params}`);
		rootEntries = await res.json();
	}

	function selectFile(name: string) {
		currentFile.set(name);
		activeView.set('editor');
	}

	function selectChange(file: ChangedFile) {
		currentFile.set(file.path);
		activeView.set('diff');
	}

	function statusLabel(file: ChangedFile): string {
		if (file.staged === '?' || file.status === '?') return 'U';
		if (file.staged === 'A' || file.status === 'A') return 'A';
		if (file.staged === 'D' || file.status === 'D') return 'D';
		return 'M';
	}

	$effect(() => {
		if ($currentWorktree) {
			loadChanges();
			loadRootEntries();
		}
	});
</script>

<Sidebar.Root bind:ref {...restProps}>
	<Sidebar.Header class="flex-row items-center justify-center gap-1 border-b border-border px-1 py-1">
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<Button
						{...props}
						variant={activeTab === 'files' ? 'secondary' : 'ghost'}
						size="icon"
						onclick={() => (activeTab = 'files')}
					>
						<FolderTreeIcon />
					</Button>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content side="bottom">Files</Tooltip.Content>
		</Tooltip.Root>
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<Button
						{...props}
						variant={activeTab === 'changes' ? 'secondary' : 'ghost'}
						size="icon"
						class="relative"
						onclick={() => (activeTab = 'changes')}
					>
						<GitBranchIcon />
						{#if changes.length > 0}
							<span class="absolute top-0.5 right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-medium text-primary-foreground">{changes.length}</span>
						{/if}
					</Button>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content side="bottom">Changes</Tooltip.Content>
		</Tooltip.Root>
	</Sidebar.Header>
	<Sidebar.Content>
		{#if activeTab === 'files'}
			<Sidebar.Group>
				<Sidebar.GroupContent>
					<Sidebar.Menu>
						{#each rootEntries as entry}
							{#if entry.type === 'directory'}
								<LazyDir name={entry.name} path={entry.name} root={$currentWorktree?.path ?? ''} />
							{:else}
								<Sidebar.MenuButton
									isActive={$currentFile === entry.name}
									class="data-[active=true]:bg-transparent"
									onclick={() => selectFile(entry.name)}
								>
									<FileIcon />
									<span>{entry.name}</span>
								</Sidebar.MenuButton>
							{/if}
						{/each}
					</Sidebar.Menu>
				</Sidebar.GroupContent>
			</Sidebar.Group>
		{:else}
			<Sidebar.Group>
				<Sidebar.GroupContent>
					<Sidebar.Menu>
						{#each changes as file}
							<Sidebar.MenuItem>
								<Sidebar.MenuButton class="pe-8" onclick={() => selectChange(file)}>
									<FileIcon />
									<span>{file.path}</span>
								</Sidebar.MenuButton>
								<Sidebar.MenuBadge>{statusLabel(file)}</Sidebar.MenuBadge>
							</Sidebar.MenuItem>
						{/each}
						{#if changes.length === 0}
							<div class="px-2 py-4 text-center text-xs text-muted-foreground">No changes</div>
						{/if}
					</Sidebar.Menu>
				</Sidebar.GroupContent>
			</Sidebar.Group>
		{/if}
	</Sidebar.Content>
	<Sidebar.Rail />
</Sidebar.Root>
