<script lang="ts">
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import FolderIcon from '@lucide/svelte/icons/folder';
	import { currentWorktree, currentFile, activeView, gitFileStatuses, statusColor, folderStatus } from '$lib/stores';
	import type { FileEntry } from '$lib/stores';
	import Self from './LazyDir.svelte';
	import FileTypeIcon from './FileTypeIcon.svelte';

	let { name, path, root }: { name: string; path: string; root: string } = $props();

	let children: FileEntry[] | null = $state(null);
	let open = $state(false);

	async function loadChildren() {
		if (children !== null) return; // already loaded
		const params = new URLSearchParams({ root, dir: path });
		const res = await fetch(`/api/files?${params}`);
		children = await res.json();
	}

	function handleToggle(isOpen: boolean) {
		open = isOpen;
		if (isOpen) loadChildren();
	}

	function selectFile(fileName: string) {
		const filePath = path === '.' ? fileName : `${path}/${fileName}`;
		currentFile.set(filePath);
		activeView.set('editor');
	}

	function childPath(childName: string): string {
		return path === '.' ? childName : `${path}/${childName}`;
	}
</script>

<Sidebar.MenuItem>
	<Collapsible.Root
		class="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90"
		{open}
		onOpenChange={handleToggle}
	>
		<Collapsible.Trigger>
			{#snippet child({ props })}
				<Sidebar.MenuButton {...props} class={statusColor(folderStatus(path, $gitFileStatuses))}>
					<ChevronRightIcon className="transition-transform" />
					<FolderIcon />
					<span>{name}</span>
				</Sidebar.MenuButton>
			{/snippet}
		</Collapsible.Trigger>
		<Collapsible.Content>
			<Sidebar.MenuSub>
				{#if children === null}
					<div class="px-2 py-1 text-xs text-muted-foreground">Loading...</div>
				{:else}
					{#each children as entry}
						{#if entry.type === 'directory'}
							<Self name={entry.name} path={childPath(entry.name)} {root} />
						{:else}
							{@const filePath = childPath(entry.name)}
							<Sidebar.MenuButton
								isActive={$currentFile === filePath}
								class="data-[active=true]:font-normal {statusColor($gitFileStatuses.get(filePath) ?? 'none')}"
								onclick={() => selectFile(entry.name)}
							>
								<FileTypeIcon filename={entry.name} />
								<span>{entry.name}</span>
							</Sidebar.MenuButton>
						{/if}
					{/each}
				{/if}
			</Sidebar.MenuSub>
		</Collapsible.Content>
	</Collapsible.Root>
</Sidebar.MenuItem>
