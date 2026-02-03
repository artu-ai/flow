<script lang="ts">
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import * as ContextMenu from '$lib/components/ui/context-menu/index.js';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import FolderIcon from '@lucide/svelte/icons/folder';
	import { currentFile, activeView, gitFileStatuses, statusColor, folderStatus, inlineEdit, showGitIgnored } from '$lib/stores';
	import type { FileEntry, GitFileStatus, InlineEditAction } from '$lib/stores';
	import type { FileChange } from '$lib/fileWatcher';
	import type { Readable } from 'svelte/store';
	import Self from './LazyDir.svelte';
	import FileTypeIcon from './FileTypeIcon.svelte';
	import InlineInput from './InlineInput.svelte';

	let { name, path, root, changes, onrefresh }: { name: string; path: string; root: string; changes?: Readable<FileChange>; onrefresh?: () => void } = $props();

	let children: FileEntry[] | null = $state(null);
	let open = $state(false);

	let myFile = $derived($currentFile[root] ?? null);
	let myStatuses = $derived($gitFileStatuses[root] ?? new Map<string, GitFileStatus>());

	function setFile(path: string | null) {
		currentFile.update((m) => ({ ...m, [root]: path }));
	}

	async function loadChildren() {
		const params = new URLSearchParams({ root, dir: path });
		if ($showGitIgnored) params.set('showGitIgnored', '1');
		const res = await fetch(`/api/files?${params}`);
		children = await res.json();
	}

	async function forceLoadChildren() {
		const params = new URLSearchParams({ root, dir: path });
		if ($showGitIgnored) params.set('showGitIgnored', '1');
		const res = await fetch(`/api/files?${params}`);
		children = await res.json();
	}

	function handleToggle(isOpen: boolean) {
		open = isOpen;
		if (isOpen && children === null) loadChildren();
	}

	$effect(() => {
		const c = changes ? $changes : null;
		if (c && c.tick > 0 && c.dir === path && children !== null) {
			forceLoadChildren();
		}
	});

	function selectFile(fileName: string) {
		const filePath = path === '.' ? fileName : `${path}/${fileName}`;
		setFile(filePath);
		activeView.set('editor');
	}

	function childPath(childName: string): string {
		return path === '.' ? childName : `${path}/${childName}`;
	}

	// Inline edit state derived from store
	let editAction = $derived($inlineEdit);
	let isCreating = $derived(
		editAction !== null &&
		(editAction.type === 'newFile' || editAction.type === 'newDir') &&
		editAction.parentPath === path
	);
	let isRenamingFolder = $derived(
		editAction !== null &&
		editAction.type === 'rename' &&
		editAction.path === path
	);

	function isRenamingChild(childPath: string): boolean {
		return editAction !== null && editAction.type === 'rename' && editAction.path === childPath;
	}

	async function handleNewFile() {
		inlineEdit.set({ type: 'newFile', parentPath: path });
		if (!open) {
			open = true;
			if (children === null) await loadChildren();
		}
	}

	async function handleNewDir() {
		inlineEdit.set({ type: 'newDir', parentPath: path });
		if (!open) {
			open = true;
			if (children === null) await loadChildren();
		}
	}

	function handleRenameFolder() {
		inlineEdit.set({ type: 'rename', path, currentName: name });
	}

	function handleRenameFile(filePath: string, fileName: string) {
		inlineEdit.set({ type: 'rename', path: filePath, currentName: fileName });
	}

	async function confirmCreate(newName: string) {
		if (!editAction || (editAction.type !== 'newFile' && editAction.type !== 'newDir')) return;
		const newPath = path === '.' ? newName : `${path}/${newName}`;
		const action = editAction.type === 'newFile' ? 'createFile' : 'createDir';
		const res = await fetch('/api/files', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action, root, path: newPath })
		});
		if (res.ok) {
			await forceLoadChildren();
			if (editAction.type === 'newFile') {
				setFile(newPath);
				activeView.set('editor');
			}
		}
		inlineEdit.set(null);
	}

	async function confirmRenameChild(newName: string, oldPath: string) {
		const parentDir = oldPath.includes('/') ? oldPath.substring(0, oldPath.lastIndexOf('/')) : '.';
		const newPath = parentDir === '.' ? newName : `${parentDir}/${newName}`;
		const res = await fetch('/api/files', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ root, oldPath, newPath })
		});
		if (res.ok) {
			if (myFile) {
				if (myFile === oldPath) {
					setFile(newPath);
				} else if (myFile.startsWith(oldPath + '/')) {
					setFile(newPath + myFile.substring(oldPath.length));
				}
			}
			await forceLoadChildren();
		}
		inlineEdit.set(null);
	}

	async function confirmRenameFolder(newName: string) {
		const parentDir = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '.';
		const newPath = parentDir === '.' ? newName : `${parentDir}/${newName}`;
		const res = await fetch('/api/files', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ root, oldPath: path, newPath })
		});
		if (res.ok) {
			if (myFile) {
				if (myFile === path) {
					setFile(newPath);
				} else if (myFile.startsWith(path + '/')) {
					setFile(newPath + myFile.substring(path.length));
				}
			}
			onrefresh?.();
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
			body: JSON.stringify({ root, path: entryPath })
		});
		if (res.ok) {
			if (myFile && (myFile === entryPath || myFile.startsWith(entryPath + '/'))) {
				setFile(null);
			}
			await forceLoadChildren();
		}
	}

	async function handleDeleteFolder() {
		const res = await fetch('/api/files', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ root, path })
		});
		if (res.ok) {
			if (myFile && (myFile === path || myFile.startsWith(path + '/'))) {
				setFile(null);
			}
			onrefresh?.();
		}
	}
</script>

<Sidebar.MenuItem>
	<Collapsible.Root
		class="group/collapsible [&[data-state=open]>div>button>svg:first-child]:rotate-90"
		{open}
		onOpenChange={handleToggle}
	>
		{#if isRenamingFolder}
			<div class="flex items-center gap-2 px-2 py-0.5">
				<FolderIcon class="size-4 shrink-0" />
				<InlineInput
					value={name}
					onconfirm={confirmRenameFolder}
					oncancel={cancelEdit}
				/>
			</div>
		{:else}
			<ContextMenu.Root>
				<ContextMenu.Trigger>
					<Collapsible.Trigger>
						{#snippet child({ props })}
							<Sidebar.MenuButton {...props} class={statusColor(folderStatus(path, myStatuses))}>
								<ChevronRightIcon className="transition-transform" />
								<FolderIcon />
								<span>{name}</span>
							</Sidebar.MenuButton>
						{/snippet}
					</Collapsible.Trigger>
				</ContextMenu.Trigger>
				<ContextMenu.Content>
					<ContextMenu.Item onclick={handleNewFile}>New File</ContextMenu.Item>
					<ContextMenu.Item onclick={handleNewDir}>New Folder</ContextMenu.Item>
					<ContextMenu.Separator />
					<ContextMenu.Item onclick={handleRenameFolder}>Rename</ContextMenu.Item>
					<ContextMenu.Item variant="destructive" onclick={handleDeleteFolder}>Delete</ContextMenu.Item>
				</ContextMenu.Content>
			</ContextMenu.Root>
		{/if}
		<Collapsible.Content>
			<Sidebar.MenuSub>
				{#if isCreating}
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
				{#if children === null}
					<div class="px-2 py-1 text-xs text-muted-foreground">Loading...</div>
				{:else}
					{#each children as entry (entry.name)}
						{#if entry.type === 'directory'}
							<Self name={entry.name} path={childPath(entry.name)} {root} {changes} onrefresh={forceLoadChildren} />
						{:else}
							{@const filePath = childPath(entry.name)}
							{#if isRenamingChild(filePath)}
								<li class="flex items-center gap-2 px-2 py-0.5">
									<FileTypeIcon filename={entry.name} />
									<InlineInput
										value={entry.name}
										selectStem={true}
										onconfirm={(newName) => confirmRenameChild(newName, filePath)}
										oncancel={cancelEdit}
									/>
								</li>
							{:else}
								<ContextMenu.Root>
									<ContextMenu.Trigger>
										<Sidebar.MenuButton
											isActive={myFile === filePath}
											class="data-[active=true]:font-normal {statusColor(myStatuses.get(filePath) ?? 'none')}"
											onclick={() => selectFile(entry.name)}
										>
											<FileTypeIcon filename={entry.name} />
											<span>{entry.name}</span>
										</Sidebar.MenuButton>
									</ContextMenu.Trigger>
									<ContextMenu.Content>
										<ContextMenu.Item onclick={() => handleRenameFile(filePath, entry.name)}>Rename</ContextMenu.Item>
										<ContextMenu.Item variant="destructive" onclick={() => handleDeleteEntry(filePath)}>Delete</ContextMenu.Item>
									</ContextMenu.Content>
								</ContextMenu.Root>
							{/if}
						{/if}
					{/each}
				{/if}
			</Sidebar.MenuSub>
		</Collapsible.Content>
	</Collapsible.Root>
</Sidebar.MenuItem>
