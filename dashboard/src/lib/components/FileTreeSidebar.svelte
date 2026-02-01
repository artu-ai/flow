<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { currentWorktree, currentFile, activeView } from '$lib/stores';
	import type { FileEntry } from '$lib/stores';
	import LazyDir from './LazyDir.svelte';
	import FileTypeIcon from './FileTypeIcon.svelte';

	let rootEntries: FileEntry[] = $state([]);

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

	$effect(() => {
		if ($currentWorktree) {
			loadRootEntries();
		}
	});
</script>

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
						<FileTypeIcon filename={entry.name} />
						<span>{entry.name}</span>
					</Sidebar.MenuButton>
				{/if}
			{/each}
		</Sidebar.Menu>
	</Sidebar.GroupContent>
</Sidebar.Group>
