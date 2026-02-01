<script lang="ts">
	import { currentWorktree, terminalSessionId } from '$lib/stores';
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import TerminalSquareIcon from '@lucide/svelte/icons/terminal';

	let container: HTMLDivElement;
	let term: any;
	let fitAddon: any;
	let ws: WebSocket | null = null;

	onMount(() => {
		return () => {
			ws?.close();
			term?.dispose();
		};
	});

	async function initTerminal(sessionId: string) {
		const { Terminal } = await import('@xterm/xterm');
		const { FitAddon } = await import('@xterm/addon-fit');

		if (term) {
			term.dispose();
		}

		term = new Terminal({
			cursorBlink: true,
			fontSize: 13,
			fontFamily: 'Menlo, Monaco, "Courier New", monospace',
			theme: {
				background: '#09090b',
				foreground: '#e4e4e7',
				cursor: '#e4e4e7',
				selectionBackground: '#3f3f46',
			},
		});

		fitAddon = new FitAddon();
		term.loadAddon(fitAddon);
		term.open(container);
		fitAddon.fit();

		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		ws = new WebSocket(`${protocol}//${window.location.host}/terminal/${sessionId}`);

		ws.onopen = () => {
			const dims = fitAddon.proposeDimensions();
			if (dims) {
				ws!.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }));
			}
		};

		ws.onmessage = (event) => {
			term.write(event.data);
		};

		ws.onclose = () => {
			term.write('\r\n\x1b[31m[Connection closed]\x1b[0m\r\n');
		};

		term.onData((data: string) => {
			if (ws?.readyState === WebSocket.OPEN) {
				ws.send(data);
			}
		});

		const resizeObserver = new ResizeObserver(() => {
			fitAddon.fit();
			const dims = fitAddon.proposeDimensions();
			if (dims && ws?.readyState === WebSocket.OPEN) {
				ws.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }));
			}
		});
		resizeObserver.observe(container);

		return () => resizeObserver.disconnect();
	}

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
				terminalSessionId.set(data.id);
			}
		} catch (e) {
			error = String(e);
		}
	}

	$effect(() => {
		const sid = $terminalSessionId;
		if (sid && container) {
			initTerminal(sid);
		}
	});
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
	{#if !$terminalSessionId}
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
	<div class="flex-1" bind:this={container} class:hidden={!$terminalSessionId}></div>
</div>
