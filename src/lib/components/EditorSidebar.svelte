<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Kbd } from '$lib/components/ui/kbd';
	import FolderTreeIcon from '@lucide/svelte/icons/folder-tree';
	import GitBranchIcon from '@lucide/svelte/icons/git-branch';
	import type { ComponentProps } from 'svelte';
	import { activeView, worktrees, currentWorktree } from '$lib/stores';
	import { useSidebar } from '$lib/components/ui/sidebar/context.svelte.js';
	import FileTreeSidebar from './FileTreeSidebar.svelte';
	import ChangesSidebar from './ChangesSidebar.svelte';
	import SidebarResizeHandle from './SidebarResizeHandle.svelte';

	let { ref = $bindable(null), onwidthchange, ...restProps }: ComponentProps<typeof Sidebar.Root> & { onwidthchange?: (width: number) => void } = $props();

	const sidebar = useSidebar();

	type SidebarTab = 'files' | 'changes';
	let activeTab: SidebarTab = $state('files');

	function switchTab(tab: SidebarTab) {
		activeTab = tab;
		activeView.set(tab === 'files' ? 'editor' : 'diff');
	}

	/** Toggle sidebar to a specific tab. If already open on that tab, close it. */
	export function focusTab(tab: SidebarTab) {
		const isOpen = sidebar.isMobile ? sidebar.openMobile : sidebar.open;
		if (isOpen && activeTab === tab) {
			if (sidebar.isMobile) {
				sidebar.setOpenMobile(false);
			} else {
				sidebar.setOpen(false);
			}
		} else {
			if (!isOpen) {
				if (sidebar.isMobile) {
					sidebar.setOpenMobile(true);
				} else {
					sidebar.setOpen(true);
				}
			}
			switchTab(tab);
		}
	}
</script>

<Sidebar.Root bind:ref {...restProps}>
	<Sidebar.Header class="h-12 flex-row items-center justify-center gap-1 border-b border-border px-1">
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<Button
						{...props}
						variant={activeTab === 'files' ? 'secondary' : 'ghost'}
						size="icon"
						onclick={() => switchTab('files')}
					>
						<FolderTreeIcon />
					</Button>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content side="bottom" class="flex items-center gap-1.5">Files <Kbd class="h-4 min-w-4 text-[10px]">⌃⇧F</Kbd></Tooltip.Content>
		</Tooltip.Root>
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<Button
						{...props}
						variant={activeTab === 'changes' ? 'secondary' : 'ghost'}
						size="icon"
						onclick={() => switchTab('changes')}
					>
						<GitBranchIcon />
					</Button>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content side="bottom" class="flex items-center gap-1.5">Changes <Kbd class="h-4 min-w-4 text-[10px]">⌃⇧G</Kbd></Tooltip.Content>
		</Tooltip.Root>
	</Sidebar.Header>
	<Sidebar.Content>
		{#each $worktrees as wt (wt.path)}
			<div class:hidden={wt.path !== $currentWorktree?.path || activeTab !== 'files'}>
				<FileTreeSidebar worktreePath={wt.path} />
			</div>
			<div class:hidden={wt.path !== $currentWorktree?.path || activeTab !== 'changes'}>
				<ChangesSidebar worktreePath={wt.path} />
			</div>
		{/each}
	</Sidebar.Content>
	{#if onwidthchange}
		<SidebarResizeHandle onresize={onwidthchange} />
	{:else}
		<Sidebar.Rail />
	{/if}
</Sidebar.Root>
