<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import * as ContextMenu from '$lib/components/ui/context-menu/index.js';
	import { currentWorktree, currentFile, activeView, gitFileStatuses, statusColor, inlineEdit } from '$lib/stores';
	import type { FileEntry, GitFileStatus, InlineEditAction } from '$lib/stores';
	import LazyDir from './LazyDir.svelte';
	import FileTypeIcon from './FileTypeIcon.svelte';
	import FolderIcon from '@lucide/svelte/icons/folder';
	import InlineInput from './InlineInput.svelte';

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

	// Inline edit state
	let editAction = $derived($inlineEdit);
	let isCreatingAtRoot = $derived(
		editAction !== null &&
		(editAction.type === 'newFile' || editAction.type === 'newDir') &&
		editAction.parentPath === '.'
	);

	function isRenamingEntry(entryName: string): boolean {
		return editAction !== null && editAction.type === 'rename' && editAction.path === entryName;
	}

	function handleNewFileAtRoot() {
		inlineEdit.set({ type: 'newFile', parentPath: '.' });
	}

	function handleNewDirAtRoot() {
		inlineEdit.set({ type: 'newDir', parentPath: '.' });
	}

	function handleRenameEntry(entryName: string) {
		inlineEdit.set({ type: 'rename', path: entryName, currentName: entryName });
	}

	async function confirmCreate(newName: string) {
		if (!$currentWorktree || !editAction) return;
		const action = editAction.type === 'newFile' ? 'createFile' : 'createDir';
		const res = await fetch('/api/files', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action, root: $currentWorktree.path, path: newName })
		});
		if (res.ok) {
			await loadRootEntries();
			await loadGitStatuses();
			if (editAction.type === 'newFile') {
				currentFile.set(newName);
				activeView.set('editor');
			}
		}
		inlineEdit.set(null);
	}

	async function confirmRename(newName: string, oldPath: string) {
		if (!$currentWorktree) return;
		const res = await fetch('/api/files', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ root: $currentWorktree.path, oldPath, newPath: newName })
		});
		if (res.ok) {
			const cf = $currentFile;
			if (cf) {
				if (cf === oldPath) {
					currentFile.set(newName);
				} else if (cf.startsWith(oldPath + '/')) {
					currentFile.set(newName + cf.substring(oldPath.length));
				}
			}
			await loadRootEntries();
			await loadGitStatuses();
		}
		inlineEdit.set(null);
	}

	function cancelEdit() {
		inlineEdit.set(null);
	}

	async function handleDeleteEntry(entryPath: string) {
		if (!$currentWorktree) return;
		const res = await fetch('/api/files', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ root: $currentWorktree.path, path: entryPath })
		});
		if (res.ok) {
			const cf = $currentFile;
			if (cf && (cf === entryPath || cf.startsWith(entryPath + '/'))) {
				currentFile.set(null);
			}
			await loadRootEntries();
			await loadGitStatuses();
		}
	}

	async function refreshRoot() {
		await loadRootEntries();
		await loadGitStatuses();
	}
</script>

<ContextMenu.Root>
	<ContextMenu.Trigger>
		<Sidebar.Group>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					{#if isCreatingAtRoot}
						<li class="flex items-center gap-2 px-2 py-0.5">
							{#if editAction?.type === 'newDir'}
								<FolderIcon class="size-4 shrink-0" />
							{:else}
								<FileTypeIcon filename="" />
							{/if}
							<InlineInput
								onconfirm={confirmCreate}
								oncancel={cancelEdit}
							/>
						</li>
					{/if}
					{#each rootEntries as entry (entry.name)}
						{#if entry.type === 'directory'}
							<LazyDir name={entry.name} path={entry.name} root={$currentWorktree?.path ?? ''} onrefresh={refreshRoot} />
						{:else if isRenamingEntry(entry.name)}
							<li class="flex items-center gap-2 px-2 py-0.5">
								<FileTypeIcon filename={entry.name} />
								<InlineInput
									value={entry.name}
									selectStem={true}
									onconfirm={(newName) => confirmRename(newName, entry.name)}
									oncancel={cancelEdit}
								/>
							</li>
						{:else}
							<ContextMenu.Root>
								<ContextMenu.Trigger>
									<Sidebar.MenuButton
										isActive={$currentFile === entry.name}
										class="data-[active=true]:font-normal {fileColor(entry.name)}"
										onclick={() => selectFile(entry.name)}
									>
										<FileTypeIcon filename={entry.name} />
										<span>{entry.name}</span>
									</Sidebar.MenuButton>
								</ContextMenu.Trigger>
								<ContextMenu.Content>
									<ContextMenu.Item onclick={() => handleRenameEntry(entry.name)}>Rename</ContextMenu.Item>
									<ContextMenu.Item variant="destructive" onclick={() => handleDeleteEntry(entry.name)}>Delete</ContextMenu.Item>
								</ContextMenu.Content>
							</ContextMenu.Root>
						{/if}
					{/each}
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>
	</ContextMenu.Trigger>
	<ContextMenu.Content>
		<ContextMenu.Item onclick={handleNewFileAtRoot}>New File</ContextMenu.Item>
		<ContextMenu.Item onclick={handleNewDirAtRoot}>New Folder</ContextMenu.Item>
	</ContextMenu.Content>
</ContextMenu.Root>
