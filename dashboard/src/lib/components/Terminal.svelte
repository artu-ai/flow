<script lang="ts">
	import { currentWorktree, terminalSessions } from '$lib/stores';
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import TerminalSquareIcon from '@lucide/svelte/icons/terminal';
	import TerminalInstance from './TerminalInstance.svelte';

	let currentSessionId = $derived($terminalSessions[$currentWorktree?.path ?? ''] ?? null);
	let sessions = $derived(Object.entries($terminalSessions));

	function destroyAllSessions() {
		for (const [, sid] of Object.entries($terminalSessions)) {
			navigator.sendBeacon(
				'/api/terminal/sessions',
				new Blob([JSON.stringify({ id: sid, _method: 'DELETE' })], { type: 'application/json' })
			);
		}
		terminalSessions.set({});
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
				terminalSessions.update((s) => ({
					...s,
					[$currentWorktree!.path]: data.id,
				}));
			}
		} catch (e) {
			error = String(e);
		}
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
	{#if !currentSessionId}
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
	{/if}
	{#each sessions as [worktreePath, sessionId] (sessionId)}
		<TerminalInstance
			{sessionId}
			visible={worktreePath === $currentWorktree?.path}
		/>
	{/each}
</div>
