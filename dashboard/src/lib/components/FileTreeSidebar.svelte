<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import * as ContextMenu from '$lib/components/ui/context-menu/index.js';
	import { currentFile, activeView, gitFileStatuses, statusColor, inlineEdit, showGitIgnored } from '$lib/stores';
	import type { FileEntry, GitFileStatus, InlineEditAction } from '$lib/stores';
	import LazyDir from './LazyDir.svelte';
	import FileTypeIcon from './FileTypeIcon.svelte';
	import FolderIcon from '@lucide/svelte/icons/folder';
	import InlineInput from './InlineInput.svelte';

	let { worktreePath }: { worktreePath: string } = $props();

	let rootEntries: FileEntry[] = $state([]);

	let myFile = $derived($currentFile[worktreePath] ?? null);
	let myStatuses = $derived($gitFileStatuses[worktreePath] ?? new Map<string, GitFileStatus>());

	function setFile(path: string | null) {
		currentFile.update((m) => ({ ...m, [worktreePath]: path }));
	}

	async function loadRootEntries() {
		const params = new URLSearchParams({ root: worktreePath, dir: '.' });
		if ($showGitIgnored) params.set('showGitIgnored', '1');
		const res = await fetch(`/api/files?${params}`);
		rootEntries = await res.json();
	}

	async function loadGitStatuses() {
		const params = new URLSearchParams({ worktree: worktreePath });
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
		gitFileStatuses.update((s) => ({ ...s, [worktreePath]: map }));
	}

	function selectFile(name: string) {
		setFile(name);
		activeView.set('editor');
	}

	function fileColor(name: string): string {
		return statusColor(myStatuses.get(name) ?? 'none');
	}

	$effect(() => {
		// Re-fetch when showGitIgnored changes
		const _ignored = $showGitIgnored;
		loadRootEntries();
		loadGitStatuses();
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
		if (!editAction) return;
		const action = editAction.type === 'newFile' ? 'createFile' : 'createDir';
		const res = await fetch('/api/files', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action, root: worktreePath, path: newName })
		});
		if (res.ok) {
			await loadRootEntries();
			await loadGitStatuses();
			if (editAction.type === 'newFile') {
				setFile(newName);
				activeView.set('editor');
			}
		}
		inlineEdit.set(null);
	}

	async function confirmRename(newName: string, oldPath: string) {
		const res = await fetch('/api/files', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ root: worktreePath, oldPath, newPath: newName })
		});
		if (res.ok) {
			if (myFile) {
				if (myFile === oldPath) {
					setFile(newName);
				} else if (myFile.startsWith(oldPath + '/')) {
					setFile(newName + myFile.substring(oldPath.length));
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
		const res = await fetch('/api/files', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ root: worktreePath, path: entryPath })
		});
		if (res.ok) {
			if (myFile && (myFile === entryPath || myFile.startsWith(entryPath + '/'))) {
				setFile(null);
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
							<LazyDir name={entry.name} path={entry.name} root={worktreePath} onrefresh={refreshRoot} />
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
										isActive={myFile === entry.name}
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
