<script lang="ts">
	import EditorSidebar from '$lib/components/EditorSidebar.svelte';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import * as Tabs from '$lib/components/ui/tabs';
	import * as Sheet from '$lib/components/ui/sheet';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { currentWorktree, worktrees, terminalSessionId, sidebarWidth, terminalWidth, hasUnsavedChanges } from '$lib/stores';
	import type { Worktree } from '$lib/stores';
	import Editor from '$lib/components/Editor.svelte';
	import Terminal from '$lib/components/Terminal.svelte';
	import PanelResizeHandle from '$lib/components/PanelResizeHandle.svelte';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import XIcon from '@lucide/svelte/icons/x';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import { onMount } from 'svelte';

	onMount(() => {
		function onBeforeUnload(e: BeforeUnloadEvent) {
			if ($terminalSessionId || $hasUnsavedChanges) {
				e.preventDefault();
			}
		}
		window.addEventListener('beforeunload', onBeforeUnload);
		return () => window.removeEventListener('beforeunload', onBeforeUnload);
	});

	function handleWorktreeChange(value: string) {
		const wt = $worktrees.find((w) => w.path === value);
		if (wt) {
			currentWorktree.set(wt);
			terminalSessionId.set(null);
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

	const MIN_TERMINAL = 200;
	const MAX_TERMINAL = 800;

	function handleTerminalResize(delta: number) {
		terminalWidth.update((w) => Math.min(MAX_TERMINAL, Math.max(MIN_TERMINAL, w - delta)));
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
				terminalSessionId.set(null);
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
			const listRes = await fetch('/api/worktrees');
			const allWorktrees: Worktree[] = await listRes.json();
			worktrees.set(allWorktrees);
			// If we deleted the active worktree, switch to the main one
			if ($currentWorktree?.path === wt.path) {
				const main = allWorktrees.find((w) => w.isMain) ?? allWorktrees[0];
				if (main) {
					currentWorktree.set(main);
					terminalSessionId.set(null);
				}
			}
		} finally {
			deletingPath = null;
			deleteTarget = null;
			deleteDialogOpen = false;
		}
	}
</script>

<div class="flex h-full">
	<!-- Left: sidebar + editor area -->
	<div class="flex min-w-0 flex-1">
		<Sidebar.Provider style="--sidebar-width: {$sidebarWidth}px">
			<EditorSidebar onwidthchange={(w) => sidebarWidth.set(w)} />
			<Sidebar.Inset class="overflow-hidden">
				<header class="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
					<Sidebar.Trigger class="-ms-1" />
					<Separator orientation="vertical" class="me-2 data-[orientation=vertical]:h-4" />

					{#if $worktrees.length > 0}
						<Tabs.Root value={$currentWorktree?.path ?? ''} onValueChange={handleWorktreeChange}>
							<Tabs.List>
								{#each $worktrees as wt}
									<Tabs.Trigger value={wt.path} class="group gap-1.5 pr-1.5">
										{wt.branch}
										{#if wt.issueId}
											<Badge variant="secondary" class="text-[10px] px-1 py-0">{wt.issueId}</Badge>
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
				</header>
				<div class="flex-1 overflow-hidden">
					<Editor />
				</div>
			</Sidebar.Inset>
		</Sidebar.Provider>
	</div>

	<!-- Right: terminal panel (full height, outside sidebar) -->
	{#if terminalOpen}
		<PanelResizeHandle onresize={handleTerminalResize} />
		<div class="flex h-full shrink-0 flex-col overflow-hidden" style="width: {$terminalWidth}px">
			<Terminal />
		</div>
	{/if}
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
