<script lang="ts">
	import EditorSidebar from '$lib/components/EditorSidebar.svelte';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import * as Tabs from '$lib/components/ui/tabs';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as ContextMenu from '$lib/components/ui/context-menu';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { Button } from '$lib/components/ui/button';
	import { Kbd } from '$lib/components/ui/kbd';
	import { currentWorktree, worktrees, terminalSessions, activeTerminalSession, sidebarWidth, terminalWidth, terminalHeight, terminalLayout, hasUnsavedChanges, worktreeOrder, hiddenWorktrees, previousWorktreePath, focusedPanel, showGitIgnored, linearApiKey, completionConfig, linterConfig, formatterConfig, currentFile, gitFileStatuses, activePhonePanel, terminalChatInputEnabled, activeView } from '$lib/stores';
	import type { Worktree } from '$lib/stores';
	import { IsPhone, IsTablet } from '$lib/hooks/is-mobile.svelte.js';
	import Editor from '$lib/components/Editor.svelte';
	import Terminal from '$lib/components/Terminal.svelte';
	import PanelResizeHandle from '$lib/components/PanelResizeHandle.svelte';
	import EnvEditor from '$lib/components/EnvEditor.svelte';
	import CreateWorktreeDialog from '$lib/components/CreateWorktreeDialog.svelte';
	import LinearSettings from '$lib/components/LinearSettings.svelte';
	import CompletionSettings from '$lib/components/CompletionSettings.svelte';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import XIcon from '@lucide/svelte/icons/x';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import PanelRightIcon from '@lucide/svelte/icons/panel-right';
	import PanelBottomIcon from '@lucide/svelte/icons/panel-bottom';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import FileKeyIcon from '@lucide/svelte/icons/file-key';
	import FolderTreeIcon from '@lucide/svelte/icons/folder-tree';
	import GitBranchIcon from '@lucide/svelte/icons/git-branch';
	import CodeIcon from '@lucide/svelte/icons/code';
	import TerminalSquareIcon from '@lucide/svelte/icons/terminal';
	import KeyboardIcon from '@lucide/svelte/icons/keyboard';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { onMount } from 'svelte';

	const isPhone = new IsPhone();
	const isTablet = new IsTablet();

	onMount(() => {
		function onBeforeUnload(e: BeforeUnloadEvent) {
			// Only block unload for unsaved editor changes (terminal sessions persist across reloads)
			if (Object.values($hasUnsavedChanges).some(Boolean)) {
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

	// Visible worktrees: ordered minus hidden (main is always visible)
	let visibleWorktrees = $derived(
		orderedWorktrees.filter((w) => w.isMain || !$hiddenWorktrees.includes(w.path))
	);

	// Hidden worktree objects for the dropdown
	let hiddenWorktreeList = $derived(
		orderedWorktrees.filter((w) => !w.isMain && $hiddenWorktrees.includes(w.path))
	);

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

	// Clean up stale paths from hiddenWorktrees when worktrees are deleted
	$effect(() => {
		const allPaths = new Set($worktrees.map((w) => w.path));
		const stale = $hiddenWorktrees.filter((p) => !allPaths.has(p));
		if (stale.length > 0) {
			hiddenWorktrees.update((h) => h.filter((p) => allPaths.has(p)));
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
		// Map visible-tab indices back to full worktreeOrder positions
		const fullPaths = orderedWorktrees.map((w) => w.path);
		const dragPath = visibleWorktrees[dragIndex]?.path;
		const dropPath = visibleWorktrees[index]?.path;
		if (!dragPath || !dropPath) return;
		const fromFull = fullPaths.indexOf(dragPath);
		const toFull = fullPaths.indexOf(dropPath);
		if (fromFull === -1 || toFull === -1) return;
		const [moved] = fullPaths.splice(fromFull, 1);
		fullPaths.splice(toFull, 0, moved);
		worktreeOrder.set(fullPaths);
		dragIndex = null;
		dropIndex = null;
	}

	function handleDragEnd() {
		dragIndex = null;
		dropIndex = null;
	}

	function hideWorktree(path: string) {
		const wt = $worktrees.find((w) => w.path === path);
		if (!wt || wt.isMain) return;
		hiddenWorktrees.update((h) => [...h, path]);
		// If hiding the active tab, switch to nearest visible neighbor
		if ($currentWorktree?.path === path) {
			const idx = visibleWorktrees.findIndex((w) => w.path === path);
			// After hiding, visibleWorktrees will update reactively, so find neighbor from orderedWorktrees
			const visible = orderedWorktrees.filter(
				(w) => w.path !== path && (w.isMain || !$hiddenWorktrees.includes(w.path))
			);
			if (visible.length > 0) {
				// Pick the nearest neighbor by index in orderedWorktrees
				const ordIdx = orderedWorktrees.findIndex((w) => w.path === path);
				let best = visible[0];
				let bestDist = Infinity;
				for (const v of visible) {
					const vIdx = orderedWorktrees.findIndex((w) => w.path === v.path);
					const dist = Math.abs(vIdx - ordIdx);
					if (dist < bestDist) {
						bestDist = dist;
						best = v;
					}
				}
				handleWorktreeChange(best.path);
			}
		}
	}

	function unhideAndSwitchTo(path: string) {
		hiddenWorktrees.update((h) => h.filter((p) => p !== path));
		handleWorktreeChange(path);
	}

	let editorRefs = $state<Record<string, Editor>>({});
	let terminalRef = $state<Terminal>();
	let editorSidebarRef = $state<EditorSidebar>();

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
		const count = visibleWorktrees.length;

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

		// Ctrl+Shift+J : jump to last notification source
		if (e.shiftKey && (e.key === 'J' || e.key === 'j')) {
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

		// Ctrl+Shift+N : open create worktree dialog
		if (e.shiftKey && (e.key === 'N' || e.key === 'n')) {
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

		// Ctrl+Shift+F : toggle sidebar Files tab
		if (e.shiftKey && (e.key === 'F' || e.key === 'f')) {
			e.preventDefault();
			editorSidebarRef?.focusTab('files');
			return;
		}

		// Ctrl+Shift+G : toggle sidebar Changes tab
		if (e.shiftKey && (e.key === 'G' || e.key === 'g')) {
			e.preventDefault();
			editorSidebarRef?.focusTab('changes');
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

		// Ctrl+1-9: switch to positional worktree tab (visible only)
		if (e.key >= '1' && e.key <= '9') {
			const idx = parseInt(e.key) - 1;
			if (idx < count) {
				e.preventDefault();
				handleWorktreeChange(visibleWorktrees[idx].path);
				requestAnimationFrame(() => restoreFocus());
			}
			return;
		}

		// Ctrl+[ / Ctrl+]: prev/next worktree tab (visible only)
		if (e.key === '[' || e.key === ']') {
			e.preventDefault();
			const currentIdx = visibleWorktrees.findIndex(
				(w) => w.path === $currentWorktree?.path
			);
			if (currentIdx === -1) return;
			const next =
				e.key === '['
					? (currentIdx - 1 + count) % count
					: (currentIdx + 1) % count;
			handleWorktreeChange(visibleWorktrees[next].path);
			requestAnimationFrame(() => restoreFocus());
		}
	}

	let terminalOpen = $state(true);
	let createDialogOpen = $state(false);
	let linearSettingsOpen = $state(false);
	let completionSettingsOpen = $state(false);

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
	const MIN_TERMINAL_TABLET = 120;
	const MAX_TERMINAL = 800;

	function handleTerminalResize(delta: number) {
		const minT = isTablet.current ? MIN_TERMINAL_TABLET : MIN_TERMINAL;
		if ($terminalLayout === 'right') {
			terminalWidth.update((w) => Math.min(MAX_TERMINAL, Math.max(minT, w - delta)));
		} else {
			terminalHeight.update((h) => Math.min(MAX_TERMINAL, Math.max(minT, h - delta)));
		}
	}

	// Constrain terminal dimensions on tablet to prevent it from dominating
	let effectiveTerminalWidth = $derived.by(() => {
		if (typeof window === 'undefined') return $terminalWidth;
		if (isTablet.current) {
			return Math.min($terminalWidth, window.innerWidth * 0.4);
		}
		return $terminalWidth;
	});

	let effectiveTerminalHeight = $derived.by(() => {
		if (typeof window === 'undefined') return $terminalHeight;
		if (isTablet.current) {
			return Math.min($terminalHeight, window.innerHeight * 0.4);
		}
		return $terminalHeight;
	});

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

<div class="flex h-full {isPhone.current ? 'pb-12' : ''}">
	<Sidebar.Provider style="--sidebar-width: {$sidebarWidth}px">
			<EditorSidebar bind:this={editorSidebarRef} onwidthchange={(w) => sidebarWidth.set(w)} />
			<Sidebar.Inset class="flex flex-col overflow-hidden">
				<header class="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
					{#if !isPhone.current}
						<Tooltip.Root>
							<Tooltip.Trigger>
								{#snippet child({ props })}
									<Sidebar.Trigger class="-ms-1" {...props} />
								{/snippet}
							</Tooltip.Trigger>
							<Tooltip.Content side="bottom" class="flex items-center gap-1.5">Toggle sidebar <Kbd class="h-4 min-w-4 text-[10px]">⌃B</Kbd></Tooltip.Content>
						</Tooltip.Root>
						<Separator orientation="vertical" class="me-2 data-[orientation=vertical]:h-4" />
					{/if}

					{#if isPhone.current}
						<!-- Phone: show current branch as text with dropdown for switching -->
						{#if $currentWorktree}
							{#if orderedWorktrees.length > 1}
								<DropdownMenu.Root>
									<DropdownMenu.Trigger>
										{#snippet child({ props })}
											<Button variant="ghost" size="sm" class="h-7 gap-1 px-2 text-sm font-medium" {...props}>
												<span class="truncate max-w-32">{$currentWorktree.branch}</span>
												<ChevronDownIcon class="h-3 w-3 opacity-50" />
											</Button>
										{/snippet}
									</DropdownMenu.Trigger>
									<DropdownMenu.Content align="start" class="w-48">
										{#each visibleWorktrees as wt}
											<DropdownMenu.Item
												class="gap-2"
												onclick={() => handleWorktreeChange(wt.path)}
											>
												<span class="truncate">{wt.branch}</span>
												{#if wt.path === $currentWorktree?.path}
													<span class="ml-auto text-xs text-muted-foreground">&#10003;</span>
												{/if}
											</DropdownMenu.Item>
										{/each}
										{#if hiddenWorktreeList.length > 0}
											<DropdownMenu.Separator />
											<DropdownMenu.Label class="text-xs text-muted-foreground">Hidden</DropdownMenu.Label>
											{#each hiddenWorktreeList as wt}
												<DropdownMenu.Item class="gap-2" onclick={() => unhideAndSwitchTo(wt.path)}>
													<EyeOffIcon class="h-3.5 w-3.5 opacity-50" />
													<span class="truncate">{wt.branch}</span>
												</DropdownMenu.Item>
											{/each}
										{/if}
									</DropdownMenu.Content>
								</DropdownMenu.Root>
							{:else}
								<span class="text-sm font-medium truncate max-w-32">{$currentWorktree.branch}</span>
							{/if}
						{/if}
					{:else}
						{#if orderedWorktrees.length > 0}
							<Tabs.Root value={$currentWorktree?.path ?? ''} onValueChange={handleWorktreeChange} class="min-w-0">
								<div class="flex items-center min-w-0 overflow-x-auto scrollbar-thin">
									{#if visibleWorktrees.length > 1}
										<Kbd class="mr-1 hidden lg:inline-flex h-4 min-w-4 text-[10px] opacity-50" title="Ctrl+[ — previous worktree">⌃[</Kbd>
									{/if}
									<Tabs.List>
										{#each visibleWorktrees as wt, i}
											<ContextMenu.Root>
												<ContextMenu.Trigger>
													<Tabs.Trigger
														value={wt.path}
														class="group gap-1.5 pr-1.5 {isTablet.current ? 'max-w-32' : 'max-w-48'} {dropIndex === i && dragIndex !== null && dragIndex < i ? 'border-r-2 border-r-primary' : ''} {dropIndex === i && dragIndex !== null && dragIndex > i ? 'border-l-2 border-l-primary' : ''}"
														draggable={true}
														ondragstart={(e: DragEvent) => handleDragStart(e, i)}
														ondragover={(e: DragEvent) => handleDragOver(e, i)}
														ondrop={(e: DragEvent) => handleDrop(e, i)}
														ondragend={handleDragEnd}
													>
														<span class="truncate">{wt.branch}</span>
														{#if i < 9}
															<Kbd class="ml-1 hidden lg:inline-flex h-4 min-w-4 text-[10px] opacity-40">⌃{i + 1}</Kbd>
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
												</ContextMenu.Trigger>
												<ContextMenu.Content class="w-48">
													{#if wt.isMain}
														<ContextMenu.Item disabled>Main worktree</ContextMenu.Item>
													{:else}
														<ContextMenu.Item class="gap-2" onclick={() => hideWorktree(wt.path)}>
															<EyeOffIcon class="h-4 w-4" />
															Hide tab
														</ContextMenu.Item>
														<ContextMenu.Separator />
														<ContextMenu.Item class="gap-2" variant="destructive" onclick={() => { deleteTarget = wt; deleteDialogOpen = true; }}>
															<TrashIcon class="h-4 w-4" />
															Delete worktree
														</ContextMenu.Item>
													{/if}
												</ContextMenu.Content>
											</ContextMenu.Root>
										{/each}
									</Tabs.List>
									{#if visibleWorktrees.length > 1}
										<Kbd class="ml-1 hidden lg:inline-flex h-4 min-w-4 text-[10px] opacity-50" title="Ctrl+] — next worktree">⌃]</Kbd>
									{/if}
								</div>
							</Tabs.Root>
						{/if}

						{#if hiddenWorktreeList.length > 0}
							<DropdownMenu.Root>
								<DropdownMenu.Trigger>
									{#snippet child({ props })}
										<Button variant="ghost" size="icon" class="relative h-7 w-7" title="Hidden tabs" {...props}>
											<EyeOffIcon class="h-4 w-4" />
											<span class="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">{hiddenWorktreeList.length}</span>
										</Button>
									{/snippet}
								</DropdownMenu.Trigger>
								<DropdownMenu.Content align="start" class="w-48">
									{#each hiddenWorktreeList as wt}
										<DropdownMenu.Item class="gap-2" onclick={() => unhideAndSwitchTo(wt.path)}>
											<EyeOffIcon class="h-3.5 w-3.5 opacity-50" />
											<span class="truncate">{wt.branch}</span>
										</DropdownMenu.Item>
									{/each}
									{#if hiddenWorktreeList.length > 1}
										<DropdownMenu.Separator />
										<DropdownMenu.Item onclick={() => hiddenWorktrees.set([])}>
											Show all tabs
										</DropdownMenu.Item>
									{/if}
								</DropdownMenu.Content>
							</DropdownMenu.Root>
						{/if}

						<Button variant="ghost" size="icon" class="h-7 w-7" onclick={() => createDialogOpen = true} title="New worktree (Ctrl+Shift+N)">
							<PlusIcon class="h-4 w-4" />
						</Button>
						<Kbd class="hidden lg:inline-flex h-4 min-w-4 text-[10px] opacity-50" title="Ctrl+Shift+N — new worktree">⌃⇧N</Kbd>
					{/if}

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
									<DropdownMenu.SubTrigger>Formatters</DropdownMenu.SubTrigger>
									<DropdownMenu.SubContent>
										<DropdownMenu.Item onclick={() => formatterConfig.update((c) => ({ ...c, biome: !c.biome }))}>
											Biome
											{#if $formatterConfig.biome}
												<span class="ml-auto text-xs text-muted-foreground">&#10003;</span>
											{/if}
										</DropdownMenu.Item>
									</DropdownMenu.SubContent>
								</DropdownMenu.Sub>
								<DropdownMenu.Sub>
									<DropdownMenu.SubTrigger>Linters</DropdownMenu.SubTrigger>
									<DropdownMenu.SubContent>
										<DropdownMenu.Item onclick={() => linterConfig.update((c) => ({ ...c, biome: !c.biome }))}>
											Biome
											{#if $linterConfig.biome}
												<span class="ml-auto text-xs text-muted-foreground">&#10003;</span>
											{/if}
										</DropdownMenu.Item>
										<DropdownMenu.Item onclick={() => linterConfig.update((c) => ({ ...c, eslint: !c.eslint }))}>
											ESLint
											{#if $linterConfig.eslint}
												<span class="ml-auto text-xs text-muted-foreground">&#10003;</span>
											{/if}
										</DropdownMenu.Item>
										<DropdownMenu.Item onclick={() => linterConfig.update((c) => ({ ...c, ruff: !c.ruff }))}>
											Ruff
											{#if $linterConfig.ruff}
												<span class="ml-auto text-xs text-muted-foreground">&#10003;</span>
											{/if}
										</DropdownMenu.Item>
									</DropdownMenu.SubContent>
								</DropdownMenu.Sub>
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
								{#if !isPhone.current}
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
									<DropdownMenu.Item class="gap-2" onclick={() => terminalChatInputEnabled.update((v) => !v)}>
										<KeyboardIcon class="h-4 w-4" />
										Terminal chat input
										{#if $terminalChatInputEnabled}
											<span class="ml-auto text-xs text-muted-foreground">&#10003;</span>
										{/if}
									</DropdownMenu.Item>
									<DropdownMenu.Separator />
								{/if}
								<DropdownMenu.Item onclick={() => linearSettingsOpen = true}>
									Linear integration
									{#if $linearApiKey}
										<span class="ml-auto text-xs text-muted-foreground">&#10003;</span>
									{/if}
								</DropdownMenu.Item>
								<DropdownMenu.Item onclick={() => completionSettingsOpen = true}>
									Code completion
									{#if $completionConfig.activeProvider}
										<span class="ml-auto text-xs text-muted-foreground">&#10003;</span>
									{/if}
								</DropdownMenu.Item>
							</DropdownMenu.Content>
						</DropdownMenu.Root>
					</div>
				</header>
				{#if isPhone.current}
					<!-- Phone: single panel view -->
					<div class="flex min-h-0 flex-1 flex-col">
						{#if $activePhonePanel === 'editor'}
							<div class="relative min-w-0 flex-1 overflow-hidden">
								{#each orderedWorktrees as wt (wt.path)}
									<div class="absolute inset-0" class:invisible={wt.path !== $currentWorktree?.path} class:pointer-events-none={wt.path !== $currentWorktree?.path}>
										<Editor bind:this={editorRefs[wt.path]} worktreePath={wt.path} />
									</div>
								{/each}
							</div>
						{:else}
							<div class="flex min-h-0 flex-1 flex-col overflow-hidden">
								<Terminal bind:this={terminalRef} chatInputEnabled={isPhone.current || $terminalChatInputEnabled} />
							</div>
						{/if}
					</div>
				{:else}
					<!-- Tablet & Desktop: split panel view -->
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
								<div class="flex h-full shrink-0 flex-col overflow-hidden" style="width: {effectiveTerminalWidth}px">
									<Terminal bind:this={terminalRef} chatInputEnabled={isPhone.current || $terminalChatInputEnabled} />
								</div>
							{:else}
								<div class="shrink-0 overflow-hidden" style="height: {effectiveTerminalHeight}px">
									<Terminal bind:this={terminalRef} chatInputEnabled={isPhone.current || $terminalChatInputEnabled} />
								</div>
							{/if}
						{/if}
					</div>
				{/if}
			</Sidebar.Inset>
			<!-- Phone bottom navigation bar (inside Provider for sidebar context) -->
			{#if isPhone.current}
				<nav class="fixed inset-x-0 bottom-0 z-40 flex h-12 items-center justify-around border-t border-border bg-background">
					<button
						class="flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-muted-foreground"
						onclick={() => editorSidebarRef?.focusTab('files')}
					>
						<FolderTreeIcon class="h-5 w-5" />
						<span class="text-[10px]">Files</span>
					</button>
					<button
						class="flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-muted-foreground"
						onclick={() => editorSidebarRef?.focusTab('changes')}
					>
						<GitBranchIcon class="h-5 w-5" />
						<span class="text-[10px]">Changes</span>
					</button>
					<button
						class="flex flex-1 flex-col items-center justify-center gap-0.5 py-1 {$activePhonePanel === 'editor' ? 'text-foreground' : 'text-muted-foreground'}"
						onclick={() => { activePhonePanel.set('editor'); activeView.set('editor'); }}
					>
						<CodeIcon class="h-5 w-5" />
						<span class="text-[10px]">Editor</span>
					</button>
					<button
						class="flex flex-1 flex-col items-center justify-center gap-0.5 py-1 {$activePhonePanel === 'terminal' ? 'text-foreground' : 'text-muted-foreground'}"
						onclick={() => activePhonePanel.set('terminal')}
					>
						<TerminalSquareIcon class="h-5 w-5" />
						<span class="text-[10px]">Terminal</span>
					</button>
				</nav>
			{/if}
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
<CompletionSettings bind:open={completionSettingsOpen} />
