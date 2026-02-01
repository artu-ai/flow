<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import FolderTreeIcon from '@lucide/svelte/icons/folder-tree';
	import GitBranchIcon from '@lucide/svelte/icons/git-branch';
	import type { ComponentProps } from 'svelte';
	import FileTreeSidebar from './FileTreeSidebar.svelte';
	import ChangesSidebar from './ChangesSidebar.svelte';

	let { ref = $bindable(null), ...restProps }: ComponentProps<typeof Sidebar.Root> = $props();

	type SidebarTab = 'files' | 'changes';
	let activeTab: SidebarTab = $state('files');
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
						onclick={() => (activeTab = 'changes')}
					>
						<GitBranchIcon />
					</Button>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content side="bottom">Changes</Tooltip.Content>
		</Tooltip.Root>
	</Sidebar.Header>
	<Sidebar.Content>
		{#if activeTab === 'files'}
			<FileTreeSidebar />
		{:else}
			<ChangesSidebar />
		{/if}
	</Sidebar.Content>
	<Sidebar.Rail />
</Sidebar.Root>
