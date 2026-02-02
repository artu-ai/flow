<script lang="ts">
	import EditorSidebar from '$lib/components/EditorSidebar.svelte';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import * as Tabs from '$lib/components/ui/tabs';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Button } from '$lib/components/ui/button';
	import { Kbd } from '$lib/components/ui/kbd';
	import { currentWorktree, worktrees, terminalSessions, activeTerminalSession, sidebarWidth, terminalWidth, terminalHeight, terminalLayout, hasUnsavedChanges, worktreeOrder, previousWorktreePath, focusedPanel, showGitIgnored, linearApiKey, currentFile, gitFileStatuses } from '$lib/stores';
	import type { Worktree } from '$lib/stores';
	import Editor from '$lib/components/Editor.svelte';
	import Terminal from '$lib/components/Terminal.svelte';
	import PanelResizeHandle from '$lib/components/PanelResizeHandle.svelte';
	import EnvEditor from '$lib/components/EnvEditor.svelte';
	import CreateWorktreeDialog from '$lib/components/CreateWorktreeDialog.svelte';
	import LinearSettings from '$lib/components/LinearSettings.svelte';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import XIcon from '@lucide/svelte/icons/x';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import PanelRightIcon from '@lucide/svelte/icons/panel-right';
	import PanelBottomIcon from '@lucide/svelte/icons/panel-bottom';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import FileKeyIcon from '@lucide/svelte/icons/file-key';
	import { onMount } from 'svelte';

	onMount(() => {
		function onBeforeUnload(e: BeforeUnloadEvent) {
			if (Object.values($terminalSessions).some((ids) => ids.length > 0) || Object.values($hasUnsavedChanges).some(Boolean)) {
				e.preventDefault();
			}
		}
		window.addEventListener('beforeunload', onBeforeUnload);
		return () => window.removeEventListener('beforeunload', onBeforeUnload);
	});

	// Derive ordered worktrees: respect saved order, append new ones at end
	let orderedWorktrees = $derived.by(() => {
		const paths = $worktrees.map((w) => w.path);
		const byPath = new Map($worktrees.map((w) => [w.path, w]));
		// Keep existing order for paths that still exist
		const ordered: Worktree[] = [];
		for (const p of $worktreeOrder) {
			const wt = byPath.get(p);
			if (wt) ordered.push(wt);
		}
		// Append any new worktrees not in the saved order
		for (const wt of $worktrees) {
			if (!$worktreeOrder.includes(wt.path)) ordered.push(wt);
		}
		return ordered;
	});

	// Keep worktreeOrder in sync with the derived list
	$effect(() => {
		const derivedPaths = orderedWorktrees.map((w) => w.path);
		const currentOrder = $worktreeOrder;
		if (
			derivedPaths.length !== currentOrder.length ||
			derivedPaths.some((p, i) => p !== currentOrder[i])
		) {
			worktreeOrder.set(derivedPaths);
		}
	});

	// Drag-and-drop state
	let dragIndex = $state<number | null>(null);
	let dropIndex = $state<number | null>(null);

	function handleDragStart(e: DragEvent, index: number) {
		dragIndex = index;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', String(index));
		}
	}

	function handleDragOver(e: DragEvent, index: number) {
		e.preventDefault();
		if (dragIndex === null || dragIndex === index) {
			dropIndex = null;
			return;
		}
		dropIndex = index;
	}

	function handleDrop(e: DragEvent, index: number) {
		e.preventDefault();
		if (dragIndex === null || dragIndex === index) return;
		const paths = orderedWorktrees.map((w) => w.path);
		const [moved] = paths.splice(dragIndex, 1);
		paths.splice(index, 0, moved);
		worktreeOrder.set(paths);
		dragIndex = null;
		dropIndex = null;
	}

	function handleDragEnd() {
		dragIndex = null;
		dropIndex = null;
	}

	let editorRefs = $state<Record<string, Editor>>({});
	let terminalRef = $state<Terminal>();

	function handleWorktreeChange(value: string) {
		const wt = $worktrees.find((w) => w.path === value);
		if (wt) {
			previousWorktreePath.set($currentWorktree?.path ?? null);
			currentWorktree.set(wt);
		}
	}

	/** Restore focus to whichever panel was last focused for the current worktree. */
	function restoreFocus() {
		const path = $currentWorktree?.path;
		if (!path) return;
		const panel = $focusedPanel[path];
		if (panel === 'terminal') {
			terminalRef?.focusActive();
		} else {
			editorRefs[path]?.focus();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!e.ctrlKey || e.altKey || e.metaKey) return;
		const count = orderedWorktrees.length;

		// Ctrl+Shift+[ or Ctrl+Shift+] (arrives as '{' or '}'): navigate terminal tabs
		if (e.shiftKey && (e.key === '{' || e.key === '}' || e.key === '[' || e.key === ']')) {
			e.preventDefault();
			const path = $currentWorktree?.path;
			if (!path) return;
			const sessions = $terminalSessions[path] ?? [];
			if (sessions.length < 2) return;
			const activeId = $activeTerminalSession[path];
			const idx = activeId ? sessions.indexOf(activeId) : 0;
			if (idx === -1) return;
			const isPrev = e.key === '{' || e.key === '[';
			const next = isPrev
				? (idx - 1 + sessions.length) % sessions.length
				: (idx + 1) % sessions.length;
			activeTerminalSession.update((s) => ({ ...s, [path]: sessions[next] }));
			return;
		}

		// Ctrl+Shift+1-9: jump to terminal tab by number
		if (e.shiftKey && e.key >= '1' && e.key <= '9') {
			e.preventDefault();
			const path = $currentWorktree?.path;
			if (!path) return;
			const sessions = $terminalSessions[path] ?? [];
			const targetIdx = parseInt(e.key) - 1;
			if (targetIdx < sessions.length) {
				activeTerminalSession.update((s) => ({ ...s, [path]: sessions[targetIdx] }));
			}
			return;
		}

		// Ctrl+Shift+T : create new terminal
		if (e.shiftKey && (e.key === 'T' || e.key === 't')) {
			e.preventDefault();
			terminalRef?.createSession();
			return;
		}

		// Ctrl+Shift+N : jump to last notification source
		if (e.shiftKey && (e.key === 'N' || e.key === 'n')) {
			e.preventDefault();
			terminalRef?.goToLastNotification();
			return;
		}

		// Ctrl+Shift+W : close active terminal
		if (e.shiftKey && (e.key === 'W' || e.key === 'w')) {
			e.preventDefault();
			terminalRef?.closeActive();
			return;
		}

		// Ctrl+Shift+E : open create worktree dialog
		if (e.shiftKey && (e.key === 'E' || e.key === 'e')) {
			e.preventDefault();
			createDialogOpen = true;
			return;
		}

		// Ctrl+Shift+D : open delete worktree dialog for current worktree
		if (e.shiftKey && (e.key === 'D' || e.key === 'd')) {
			e.preventDefault();
			if ($currentWorktree && !$currentWorktree.isMain) {
				deleteTarget = $currentWorktree;
				deleteDialogOpen = true;
			}
			return;
		}

		if (e.shiftKey) return;

		// Ctrl+` : focus the active terminal, or create one if none exist
		if (e.key === '`') {
			e.preventDefault();
			const path = $currentWorktree?.path;
			if (path && ($terminalSessions[path]?.length ?? 0) === 0) {
				terminalRef?.createSession();
			} else {
				terminalRef?.focusActive();
			}
			return;
		}

		if (count === 0) return;

		// Ctrl+1-9: switch to positional worktree tab
		if (e.key >= '1' && e.key <= '9') {
			const idx = parseInt(e.key) - 1;
			if (idx < count) {
				e.preventDefault();
				handleWorktreeChange(orderedWorktrees[idx].path);
				requestAnimationFrame(() => restoreFocus());
			}
			return;
		}

		// Ctrl+[ / Ctrl+]: prev/next worktree tab
		if (e.key === '[' || e.key === ']') {
			e.preventDefault();
			const currentIdx = orderedWorktrees.findIndex(
				(w) => w.path === $currentWorktree?.path
			);
			if (currentIdx === -1) return;
			const next =
				e.key === '['
					? (currentIdx - 1 + count) % count
					: (currentIdx + 1) % count;
			handleWorktreeChange(orderedWorktrees[next].path);
			requestAnimationFrame(() => restoreFocus());
		}
	}

	let terminalOpen = $state(true);
	let createDialogOpen = $state(false);
	let linearSettingsOpen = $state(false);

	async function handleWorktreeCreated(data: { worktreePath: string }) {
		const listRes = await fetch('/api/worktrees');
		const allWorktrees: Worktree[] = await listRes.json();
		worktrees.set(allWorktrees);
		const newWt = allWorktrees.find((w: Worktree) => w.path === data.worktreePath);
		if (newWt) {
			currentWorktree.set(newWt);
		}
	}

	let deletingPath = $state<string | null>(null);
	let deleteTarget = $state<Worktree | null>(null);
	let deleteDialogOpen = $state(false);

	// Env editor state
	let envFiles = $state<string[]>([]);
	let envEditorOpen = $state(false);
	let envEditorFile = $state('');

	async function loadEnvFiles() {
		if (!$currentWorktree) return;
		try {
			const params = new URLSearchParams({ root: $currentWorktree.path });
			const res = await fetch(`/api/env-files?${params}`);
			envFiles = await res.json();
		} catch {
			envFiles = [];
		}
	}

	function openEnvEditor(file: string) {
		envEditorFile = file;
		envEditorOpen = true;
	}

	const MIN_TERMINAL = 150;
	const MAX_TERMINAL = 800;

	function handleTerminalResize(delta: number) {
		if ($terminalLayout === 'right') {
			terminalWidth.update((w) => Math.min(MAX_TERMINAL, Math.max(MIN_TERMINAL, w - delta)));
		} else {
			terminalHeight.update((h) => Math.min(MAX_TERMINAL, Math.max(MIN_TERMINAL, h - delta)));
		}
	}

	function promptDeleteWorktree(e: MouseEvent, wt: Worktree) {
		e.stopPropagation();
		deleteTarget = wt;
		deleteDialogOpen = true;
	}

	async function confirmDeleteWorktree() {
		if (!deleteTarget || deletingPath) return;
		const wt = deleteTarget;
		deletingPath = wt.path;
		try {
			const res = await fetch('/api/worktrees', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ worktreePath: wt.path }),
			});
			if (!res.ok) {
				const data = await res.json();
				console.error('Failed to delete worktree:', data.error);
				return;
			}
			// Clean up all terminal sessions for the deleted worktree
			const sids = $terminalSessions[wt.path] ?? [];
			for (const sid of sids) {
				fetch('/api/terminal/sessions', {
					method: 'DELETE',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ id: sid }),
				});
			}
			if (sids.length > 0) {
				terminalSessions.update((s) => {
					const { [wt.path]: _, ...rest } = s;
					return rest;
				});
				activeTerminalSession.update((s) => {
					const { [wt.path]: _, ...rest } = s;
					return rest;
				});
			}
			// Clean up per-worktree editor state
			currentFile.update((s) => { const { [wt.path]: _, ...rest } = s; return rest; });
			hasUnsavedChanges.update((s) => { const { [wt.path]: _, ...rest } = s; return rest; });
			gitFileStatuses.update((s) => { const { [wt.path]: _, ...rest } = s; return rest; });
			delete editorRefs[wt.path];
			const listRes = await fetch('/api/worktrees');
			const allWorktrees: Worktree[] = await listRes.json();
			worktrees.set(allWorktrees);
			// If we deleted the active worktree, switch to the main one
			if ($currentWorktree?.path === wt.path) {
				const main = allWorktrees.find((w) => w.isMain) ?? allWorktrees[0];
				if (main) {
					currentWorktree.set(main);
				}
			}
		} finally {
			deletingPath = null;
			deleteTarget = null;
			deleteDialogOpen = false;
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="flex h-full">
	<Sidebar.Provider style="--sidebar-width: {$sidebarWidth}px">
			<EditorSidebar onwidthchange={(w) => sidebarWidth.set(w)} />
			<Sidebar.Inset class="flex flex-col overflow-hidden">
				<header class="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
					<Sidebar.Trigger class="-ms-1" />
					<Separator orientation="vertical" class="me-2 data-[orientation=vertical]:h-4" />

					{#if orderedWorktrees.length > 0}
						<Tabs.Root value={$currentWorktree?.path ?? ''} onValueChange={handleWorktreeChange}>
							<div class="flex items-center">
								{#if orderedWorktrees.length > 1}
									<Kbd class="mr-1 hidden sm:inline-flex h-4 min-w-4 text-[10px] opacity-50" title="Ctrl+[ — previous worktree">⌃[</Kbd>
								{/if}
								<Tabs.List>
									{#each orderedWorktrees as wt, i}
										<Tabs.Trigger
											value={wt.path}
											class="group gap-1.5 pr-1.5 {dropIndex === i && dragIndex !== null && dragIndex < i ? 'border-r-2 border-r-primary' : ''} {dropIndex === i && dragIndex !== null && dragIndex > i ? 'border-l-2 border-l-primary' : ''}"
											draggable={true}
											ondragstart={(e: DragEvent) => handleDragStart(e, i)}
											ondragover={(e: DragEvent) => handleDragOver(e, i)}
											ondrop={(e: DragEvent) => handleDrop(e, i)}
											ondragend={handleDragEnd}
										>
											{wt.branch}
											{#if i < 9}
												<Kbd class="ml-1 h-4 min-w-4 text-[10px] opacity-40">⌃{i + 1}</Kbd>
											{/if}
											{#if !wt.isMain}
												<button
													class="ml-0.5 rounded-sm opacity-60 hover:opacity-100 hover:bg-muted-foreground/20"
													onclick={(e) => promptDeleteWorktree(e, wt)}
													disabled={deletingPath === wt.path}
												>
													{#if deletingPath === wt.path}
														<LoaderCircleIcon class="h-3 w-3 animate-spin" />
													{:else}
														<XIcon class="h-3 w-3" />
													{/if}
												</button>
											{/if}
										</Tabs.Trigger>
									{/each}
								</Tabs.List>
								{#if orderedWorktrees.length > 1}
									<Kbd class="ml-1 hidden sm:inline-flex h-4 min-w-4 text-[10px] opacity-50" title="Ctrl+] — next worktree">⌃]</Kbd>
								{/if}
							</div>
						</Tabs.Root>
					{/if}

					<Button variant="ghost" size="icon" class="h-7 w-7" onclick={() => createDialogOpen = true} title="New worktree (Ctrl+Shift+E)">
						<PlusIcon class="h-4 w-4" />
					</Button>
					<Kbd class="hidden sm:inline-flex h-4 min-w-4 text-[10px] opacity-50" title="Ctrl+Shift+E — new worktree">⌃⇧E</Kbd>

					<div class="ml-auto">
						<DropdownMenu.Root>
							<DropdownMenu.Trigger>
								{#snippet child({ props })}
									<Button variant="ghost" size="icon" class="h-7 w-7" {...props}>
										<SettingsIcon class="h-4 w-4" />
									</Button>
								{/snippet}
							</DropdownMenu.Trigger>
							<DropdownMenu.Content align="end" class="w-48">
								<DropdownMenu.Item class="gap-2" onclick={() => showGitIgnored.update((v) => !v)}>
									<EyeIcon class="h-4 w-4" />
									Show ignored files
									{#if $showGitIgnored}
										<span class="ml-auto text-xs text-muted-foreground">&#10003;</span>
									{/if}
								</DropdownMenu.Item>
								<DropdownMenu.Sub>
									<DropdownMenu.SubTrigger class="gap-2" onclick={loadEnvFiles}>
										<FileKeyIcon class="h-4 w-4" />
										Environment
									</DropdownMenu.SubTrigger>
									<DropdownMenu.SubContent>
										{#if envFiles.length === 0}
											<DropdownMenu.Item disabled>No .env files</DropdownMenu.Item>
										{:else}
											{#each envFiles as file}
												<DropdownMenu.Item class="font-mono text-xs" onclick={() => openEnvEditor(file)}>
													{file}
												</DropdownMenu.Item>
											{/each}
										{/if}
									</DropdownMenu.SubContent>
								</DropdownMenu.Sub>
								<DropdownMenu.Separator />
								<DropdownMenu.Sub>
									<DropdownMenu.SubTrigger>Terminal position</DropdownMenu.SubTrigger>
									<DropdownMenu.SubContent>
										<DropdownMenu.Item class="gap-2" onclick={() => terminalLayout.set('right')}>
											<PanelRightIcon class="h-4 w-4" />
											Right
											{#if $terminalLayout === 'right'}
												<span class="ml-auto text-xs text-muted-foreground">&#10003;</span>
											{/if}
										</DropdownMenu.Item>
										<DropdownMenu.Item class="gap-2" onclick={() => terminalLayout.set('bottom')}>
											<PanelBottomIcon class="h-4 w-4" />
											Bottom
											{#if $terminalLayout === 'bottom'}
												<span class="ml-auto text-xs text-muted-foreground">&#10003;</span>
											{/if}
										</DropdownMenu.Item>
									</DropdownMenu.SubContent>
								</DropdownMenu.Sub>
								<DropdownMenu.Separator />
								<DropdownMenu.Item onclick={() => linearSettingsOpen = true}>
									Linear integration
									{#if $linearApiKey}
										<span class="ml-auto text-xs text-muted-foreground">&#10003;</span>
									{/if}
								</DropdownMenu.Item>
							</DropdownMenu.Content>
						</DropdownMenu.Root>
					</div>
				</header>
				<div class="flex min-h-0 flex-1 {$terminalLayout === 'bottom' ? 'flex-col' : ''}">
					<div class="relative min-w-0 flex-1 overflow-hidden">
						{#each orderedWorktrees as wt (wt.path)}
							<div class="absolute inset-0" class:invisible={wt.path !== $currentWorktree?.path} class:pointer-events-none={wt.path !== $currentWorktree?.path}>
								<Editor bind:this={editorRefs[wt.path]} worktreePath={wt.path} />
							</div>
						{/each}
					</div>
					{#if terminalOpen}
						<PanelResizeHandle orientation={$terminalLayout === 'bottom' ? 'horizontal' : 'vertical'} onresize={handleTerminalResize} />
						{#if $terminalLayout === 'right'}
							<div class="flex h-full shrink-0 flex-col overflow-hidden" style="width: {$terminalWidth}px">
								<Terminal bind:this={terminalRef} />
							</div>
						{:else}
							<div class="shrink-0 overflow-hidden" style="height: {$terminalHeight}px">
								<Terminal bind:this={terminalRef} />
							</div>
						{/if}
					{/if}
				</div>
			</Sidebar.Inset>
	</Sidebar.Provider>
</div>

<AlertDialog.Root bind:open={deleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete worktree</AlertDialog.Title>
			<AlertDialog.Description>
				This will remove the <strong>{deleteTarget?.branch}</strong> worktree and delete its local branch. This cannot be undone.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				onclick={confirmDeleteWorktree}
				class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
			>
				{#if deletingPath}
					<LoaderCircleIcon class="mr-2 h-4 w-4 animate-spin" />
					Deleting...
				{:else}
					Delete
				{/if}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

{#if $currentWorktree}
	<EnvEditor bind:open={envEditorOpen} filePath={envEditorFile} worktreePath={$currentWorktree.path} />
{/if}

<CreateWorktreeDialog bind:open={createDialogOpen} oncreated={handleWorktreeCreated} />
<LinearSettings bind:open={linearSettingsOpen} />
