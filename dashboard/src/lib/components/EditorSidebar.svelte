<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import FolderTreeIcon from '@lucide/svelte/icons/folder-tree';
	import GitBranchIcon from '@lucide/svelte/icons/git-branch';
	import type { ComponentProps } from 'svelte';
	import { activeView } from '$lib/stores';
	import FileTreeSidebar from './FileTreeSidebar.svelte';
	import ChangesSidebar from './ChangesSidebar.svelte';
	import SidebarResizeHandle from './SidebarResizeHandle.svelte';

	let { ref = $bindable(null), onwidthchange, ...restProps }: ComponentProps<typeof Sidebar.Root> & { onwidthchange?: (width: number) => void } = $props();

	type SidebarTab = 'files' | 'changes';
	let activeTab: SidebarTab = $state('files');

	function switchTab(tab: SidebarTab) {
		activeTab = tab;
		activeView.set(tab === 'files' ? 'editor' : 'diff');
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
			<Tooltip.Content side="bottom">Files</Tooltip.Content>
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
			<Tooltip.Content side="bottom">Changes</Tooltip.Content>
		</Tooltip.Root>
	</Sidebar.Header>
	<Sidebar.Content>
		<div class:hidden={activeTab !== 'files'}>
			<FileTreeSidebar />
		</div>
		<div class:hidden={activeTab !== 'changes'}>
			<ChangesSidebar />
		</div>
	</Sidebar.Content>
	{#if onwidthchange}
		<SidebarResizeHandle onresize={onwidthchange} />
	{:else}
		<Sidebar.Rail />
	{/if}
</Sidebar.Root>
