<script lang="ts">
	import { currentWorktree, terminalSessions, activeTerminalSession } from '$lib/stores';
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import TerminalSquareIcon from '@lucide/svelte/icons/terminal';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import XIcon from '@lucide/svelte/icons/x';
	import TerminalInstance from './TerminalInstance.svelte';

	// Per-worktree label counter so new tabs get incrementing numbers
	let labelCounters: Record<string, number> = {};

	function nextLabel(worktreePath: string): number {
		const count = (labelCounters[worktreePath] ?? 0) + 1;
		labelCounters[worktreePath] = count;
		return count;
	}

	// Maps sessionId → display label
	let sessionLabels: Record<string, string> = $state({});
	// Sessions that were manually renamed (don't override with escape sequence titles)
	let manuallyRenamed: Set<string> = new Set();
	// Inline rename state
	let renamingSessionId = $state<string | null>(null);
	let renameValue = $state('');

	function handleTitleChange(sessionId: string, title: string) {
		if (manuallyRenamed.has(sessionId)) return;
		if (title.trim()) {
			sessionLabels[sessionId] = title;
		}
	}

	function startRename(sessionId: string) {
		renamingSessionId = sessionId;
		renameValue = sessionLabels[sessionId] ?? '';
	}

	function confirmRename() {
		if (renamingSessionId && renameValue.trim()) {
			sessionLabels[renamingSessionId] = renameValue.trim();
			manuallyRenamed.add(renamingSessionId);
		}
		renamingSessionId = null;
	}

	function cancelRename() {
		renamingSessionId = null;
	}

	let currentSessions = $derived($terminalSessions[$currentWorktree?.path ?? ''] ?? []);
	let activeSession = $derived($activeTerminalSession[$currentWorktree?.path ?? ''] ?? null);
	let allSessions = $derived(
		Object.entries($terminalSessions).flatMap(([worktreePath, ids]) =>
			ids.map((id) => ({ worktreePath, sessionId: id }))
		)
	);

	function destroyAllSessions() {
		for (const [, ids] of Object.entries($terminalSessions)) {
			for (const sid of ids) {
				navigator.sendBeacon(
					'/api/terminal/sessions',
					new Blob([JSON.stringify({ id: sid, _method: 'DELETE' })], { type: 'application/json' })
				);
			}
		}
		terminalSessions.set({});
		activeTerminalSession.set({});
	}

	onMount(() => {
		window.addEventListener('unload', destroyAllSessions);
		return () => window.removeEventListener('unload', destroyAllSessions);
	});

	let error: string | null = $state(null);

	async function createSession() {
		if (!$currentWorktree) return;
		error = null;

		try {
			const res = await fetch('/api/terminal/sessions', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ worktree: $currentWorktree.path }),
			});
			const data = await res.json();
			if (data.error) {
				error = data.error;
				return;
			}
			if (data.id) {
				const path = $currentWorktree!.path;
				const label = nextLabel(path);
				sessionLabels[data.id] = `Terminal ${label}`;
				terminalSessions.update((s) => ({
					...s,
					[path]: [...(s[path] ?? []), data.id],
				}));
				activeTerminalSession.update((s) => ({
					...s,
					[path]: data.id,
				}));
			}
		} catch (e) {
			error = String(e);
		}
	}

	async function closeSession(sessionId: string) {
		if (!$currentWorktree) return;
		const path = $currentWorktree.path;
		const sessions = $terminalSessions[path] ?? [];
		const idx = sessions.indexOf(sessionId);

		// Remove from store
		terminalSessions.update((s) => {
			const updated = (s[path] ?? []).filter((id) => id !== sessionId);
			if (updated.length === 0) {
				const { [path]: _, ...rest } = s;
				return rest;
			}
			return { ...s, [path]: updated };
		});

		// If it was active, switch to adjacent tab
		if (activeSession === sessionId) {
			const remaining = sessions.filter((id) => id !== sessionId);
			if (remaining.length > 0) {
				const newIdx = Math.min(idx, remaining.length - 1);
				activeTerminalSession.update((s) => ({ ...s, [path]: remaining[newIdx] }));
			} else {
				activeTerminalSession.update((s) => {
					const { [path]: _, ...rest } = s;
					return rest;
				});
			}
		}

		// Clean up label and rename tracking
		delete sessionLabels[sessionId];
		manuallyRenamed.delete(sessionId);

		// Delete server-side session
		fetch('/api/terminal/sessions', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id: sessionId }),
		});
	}

	function switchToSession(sessionId: string) {
		if (!$currentWorktree) return;
		activeTerminalSession.update((s) => ({
			...s,
			[$currentWorktree!.path]: sessionId,
		}));
	}

	// Drag-and-drop state for terminal tabs
	let dragIdx = $state<number | null>(null);
	let dropIdx = $state<number | null>(null);

	function handleDragStart(e: DragEvent, index: number) {
		dragIdx = index;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', String(index));
		}
	}

	function handleDragOver(e: DragEvent, index: number) {
		e.preventDefault();
		if (dragIdx === null || dragIdx === index) {
			dropIdx = null;
			return;
		}
		dropIdx = index;
	}

	function handleDrop(e: DragEvent, index: number) {
		e.preventDefault();
		if (!$currentWorktree || dragIdx === null || dragIdx === index) return;
		const path = $currentWorktree.path;
		const ids = [...($terminalSessions[path] ?? [])];
		const [moved] = ids.splice(dragIdx, 1);
		ids.splice(index, 0, moved);
		terminalSessions.update((s) => ({ ...s, [path]: ids }));
		dragIdx = null;
		dropIdx = null;
	}

	function handleDragEnd() {
		dragIdx = null;
		dropIdx = null;
	}
</script>

<svelte:head>
	<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/css/xterm.min.css" />
</svelte:head>

<style>
	:global(.xterm-viewport) {
		scrollbar-width: thin;
		scrollbar-color: var(--border) transparent;
	}
	:global(.xterm-viewport::-webkit-scrollbar) {
		width: 8px;
	}
	:global(.xterm-viewport::-webkit-scrollbar-track) {
		background: transparent;
	}
	:global(.xterm-viewport::-webkit-scrollbar-thumb) {
		background-color: var(--border);
		border-radius: 9999px;
	}
	:global(.xterm-viewport::-webkit-scrollbar-thumb:hover) {
		background-color: var(--ring);
	}
</style>

<div class="flex min-h-0 flex-1 flex-col">
	{#if currentSessions.length === 0}
		<div class="flex flex-1 flex-col items-center justify-center gap-3">
			<TerminalSquareIcon class="size-8 text-muted-foreground" />
			<Button
				variant="secondary"
				onclick={createSession}
				disabled={!$currentWorktree}
			>
				Open Terminal{$currentWorktree ? ` in ${$currentWorktree.branch}` : ''}
			</Button>
			{#if error}
				<p class="text-xs text-destructive max-w-64 text-center">{error}</p>
			{/if}
		</div>
	{:else}
		<!-- Tab bar -->
		<div class="flex h-8 shrink-0 items-center border-b border-border bg-muted/30 px-1 gap-0.5 overflow-x-auto">
			{#each currentSessions as sessionId, i (sessionId)}
				<button
					class="group flex h-6 items-center gap-1 rounded px-2 text-xs whitespace-nowrap transition-colors
						{sessionId === activeSession ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}
						{dropIdx === i && dragIdx !== null && dragIdx < i ? 'border-r-2 border-r-primary' : ''}
						{dropIdx === i && dragIdx !== null && dragIdx > i ? 'border-l-2 border-l-primary' : ''}"
					onclick={() => switchToSession(sessionId)}
					ondblclick={() => startRename(sessionId)}
					draggable={true}
					ondragstart={(e: DragEvent) => handleDragStart(e, i)}
					ondragover={(e: DragEvent) => handleDragOver(e, i)}
					ondrop={(e: DragEvent) => handleDrop(e, i)}
					ondragend={handleDragEnd}
				>
					{#if renamingSessionId === sessionId}
						<!-- svelte-ignore a11y_autofocus -->
						<input
							class="w-20 bg-transparent text-xs outline-none border-b border-primary"
							bind:value={renameValue}
							autofocus
							onblur={confirmRename}
							onkeydown={(e: KeyboardEvent) => {
								if (e.key === 'Enter') { e.preventDefault(); confirmRename(); }
								else if (e.key === 'Escape') { e.preventDefault(); cancelRename(); }
								e.stopPropagation();
							}}
							onclick={(e: MouseEvent) => e.stopPropagation()}
						/>
					{:else}
						{sessionLabels[sessionId] ?? `Terminal ${i + 1}`}
					{/if}
					<span
						role="button"
						tabindex="-1"
						class="ml-0.5 rounded-sm opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-muted-foreground/20"
						onclick={(e: MouseEvent) => { e.stopPropagation(); closeSession(sessionId); }}
						onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter') { e.stopPropagation(); closeSession(sessionId); } }}
					>
						<XIcon class="h-3 w-3" />
					</span>
				</button>
			{/each}
			<button
				class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted"
				onclick={createSession}
				title="New terminal"
			>
				<PlusIcon class="h-3.5 w-3.5" />
			</button>
		</div>
		{#if error}
			<p class="text-xs text-destructive px-2 py-1">{error}</p>
		{/if}
	{/if}
	{#each allSessions as { worktreePath, sessionId } (sessionId)}
		<TerminalInstance
			{sessionId}
			visible={worktreePath === $currentWorktree?.path && sessionId === activeSession}
			ontitlechange={(title) => handleTitleChange(sessionId, title)}
		/>
	{/each}
</div>
