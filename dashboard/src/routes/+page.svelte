<script lang="ts">
	import EditorSidebar from '$lib/components/EditorSidebar.svelte';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import * as Tabs from '$lib/components/ui/tabs';
	import * as Sheet from '$lib/components/ui/sheet';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { currentWorktree, worktrees, terminalSessions, sidebarWidth, terminalWidth, terminalHeight, terminalLayout, hasUnsavedChanges, worktreeOrder, previousWorktreePath } from '$lib/stores';
	import type { Worktree, TerminalLayout } from '$lib/stores';
	import Editor from '$lib/components/Editor.svelte';
	import Terminal from '$lib/components/Terminal.svelte';
	import PanelResizeHandle from '$lib/components/PanelResizeHandle.svelte';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import XIcon from '@lucide/svelte/icons/x';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import PanelRightIcon from '@lucide/svelte/icons/panel-right';
	import PanelBottomIcon from '@lucide/svelte/icons/panel-bottom';
	import { onMount } from 'svelte';

	onMount(() => {
		function onBeforeUnload(e: BeforeUnloadEvent) {
			if (Object.keys($terminalSessions).length > 0 || $hasUnsavedChanges) {
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

	function handleWorktreeChange(value: string) {
		const wt = $worktrees.find((w) => w.path === value);
		if (wt) {
			previousWorktreePath.set($currentWorktree?.path ?? null);
			currentWorktree.set(wt);
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!e.ctrlKey || e.shiftKey || e.altKey || e.metaKey) return;
		const count = orderedWorktrees.length;
		if (count === 0) return;

		// Ctrl+1 through Ctrl+9: switch to positional tab
		if (e.key >= '1' && e.key <= '9') {
			const idx = parseInt(e.key) - 1;
			if (idx < count) {
				e.preventDefault();
				handleWorktreeChange(orderedWorktrees[idx].path);
			}
			return;
		}

		// Ctrl+[ / Ctrl+]: prev/next tab
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
		}
	}

	let terminalOpen = $state(true);
	let sheetOpen = $state(false);
	let branchName = $state('');
	let creating = $state(false);
	let createError = $state('');
	let deletingPath = $state<string | null>(null);
	let deleteTarget = $state<Worktree | null>(null);
	let deleteDialogOpen = $state(false);

	const MIN_TERMINAL = 150;
	const MAX_TERMINAL = 800;

	function handleTerminalResize(delta: number) {
		if ($terminalLayout === 'right') {
			terminalWidth.update((w) => Math.min(MAX_TERMINAL, Math.max(MIN_TERMINAL, w - delta)));
		} else {
			terminalHeight.update((h) => Math.min(MAX_TERMINAL, Math.max(MIN_TERMINAL, h - delta)));
		}
	}

	async function handleCreateWorktree() {
		createError = '';
		if (!branchName.trim()) {
			createError = 'Branch name is required';
			return;
		}
		creating = true;
		try {
			const res = await fetch('/api/worktrees', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ branchName: branchName.trim() }),
			});
			const data = await res.json();
			if (!res.ok) {
				createError = data.error || 'Failed to create worktree';
				return;
			}
			// Refresh worktree list
			const listRes = await fetch('/api/worktrees');
			const allWorktrees: Worktree[] = await listRes.json();
			worktrees.set(allWorktrees);
			// Switch to the new worktree
			const newWt = allWorktrees.find((w: Worktree) => w.path === data.worktreePath);
			if (newWt) {
				currentWorktree.set(newWt);
			}
			// Reset and close
			branchName = '';
			sheetOpen = false;
		} catch (e) {
			createError = e instanceof Error ? e.message : 'An unexpected error occurred';
		} finally {
			creating = false;
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
			// Clean up the deleted worktree's terminal session
			const sid = $terminalSessions[wt.path];
			if (sid) {
				fetch('/api/terminal/sessions', {
					method: 'DELETE',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ id: sid }),
				});
				terminalSessions.update((s) => {
					const { [wt.path]: _, ...rest } = s;
					return rest;
				});
			}
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
						</Tabs.Root>
					{/if}

					<Sheet.Root bind:open={sheetOpen}>
						<Sheet.Trigger>
							{#snippet child({ props })}
								<Button variant="ghost" size="icon" class="h-7 w-7" {...props}>
									<PlusIcon class="h-4 w-4" />
								</Button>
							{/snippet}
						</Sheet.Trigger>
						<Sheet.Content>
							<Sheet.Header>
								<Sheet.Title>New Worktree</Sheet.Title>
								<Sheet.Description>Create a new git worktree with a new branch.</Sheet.Description>
							</Sheet.Header>
							<form
								class="flex flex-col gap-4 px-4"
								onsubmit={(e) => { e.preventDefault(); handleCreateWorktree(); }}
							>
								<div class="flex flex-col gap-2">
									<label for="branch-name" class="text-sm font-medium">Branch name</label>
									<Input
										id="branch-name"
										placeholder="feature/my-branch"
										bind:value={branchName}
										disabled={creating}
									/>
									{#if createError}
										<p class="text-sm text-destructive">{createError}</p>
									{/if}
								</div>
								<Button type="submit" disabled={creating}>
									{#if creating}
										<LoaderCircleIcon class="mr-2 h-4 w-4 animate-spin" />
										Creating...
									{:else}
										Create
									{/if}
								</Button>
							</form>
						</Sheet.Content>
					</Sheet.Root>

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
							</DropdownMenu.Content>
						</DropdownMenu.Root>
					</div>
				</header>
				<div class="flex min-h-0 flex-1 {$terminalLayout === 'bottom' ? 'flex-col' : ''}">
					<div class="min-w-0 flex-1 overflow-hidden">
						<Editor />
					</div>
					{#if terminalOpen}
						<PanelResizeHandle orientation={$terminalLayout === 'bottom' ? 'horizontal' : 'vertical'} onresize={handleTerminalResize} />
						{#if $terminalLayout === 'right'}
							<div class="flex h-full shrink-0 flex-col overflow-hidden" style="width: {$terminalWidth}px">
								<Terminal />
							</div>
						{:else}
							<div class="shrink-0 overflow-hidden" style="height: {$terminalHeight}px">
								<Terminal />
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
