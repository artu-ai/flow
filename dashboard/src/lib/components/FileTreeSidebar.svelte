<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { currentWorktree, currentFile, activeView, gitFileStatuses, statusColor } from '$lib/stores';
	import type { FileEntry, GitFileStatus } from '$lib/stores';
	import LazyDir from './LazyDir.svelte';
	import FileTypeIcon from './FileTypeIcon.svelte';

	let rootEntries: FileEntry[] = $state([]);

	async function loadRootEntries() {
		if (!$currentWorktree) return;
		const params = new URLSearchParams({ root: $currentWorktree.path, dir: '.' });
		const res = await fetch(`/api/files?${params}`);
		rootEntries = await res.json();
	}

	async function loadGitStatuses() {
		if (!$currentWorktree) return;
		const params = new URLSearchParams({ worktree: $currentWorktree.path });
		const res = await fetch(`/api/git/status?${params}`);
		const data = await res.json();
		const map = new Map<string, GitFileStatus>();
		for (const file of data.files || []) {
			if (file.staged === '?' || file.status === '?') map.set(file.path, 'untracked');
			else if (file.staged === 'A' || file.status === 'A') map.set(file.path, 'added');
			else if (file.staged === 'D' || file.status === 'D') map.set(file.path, 'deleted');
			else if (file.staged === 'R' || file.status === 'R') map.set(file.path, 'renamed');
			else map.set(file.path, 'modified');
		}
		gitFileStatuses.set(map);
	}

	function selectFile(name: string) {
		currentFile.set(name);
		activeView.set('editor');
	}

	function fileColor(name: string): string {
		return statusColor($gitFileStatuses.get(name) ?? 'none');
	}

	$effect(() => {
		if ($currentWorktree) {
			loadRootEntries();
			loadGitStatuses();
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
						class="data-[active=true]:font-normal {fileColor(entry.name)}"
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
