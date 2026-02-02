<script lang="ts">
	import { onMount } from 'svelte';

	let { sessionId, visible }: { sessionId: string; visible: boolean } = $props();

	let container: HTMLDivElement;
	let term: any;
	let fitAddon: any;
	let ws: WebSocket | null = null;
	let resizeObserver: ResizeObserver | null = null;

	onMount(() => {
		initTerminal();
		return () => cleanup();
	});

	async function initTerminal() {
		const { Terminal } = await import('@xterm/xterm');
		const { FitAddon } = await import('@xterm/addon-fit');

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
			term?.write('\r\n\x1b[31m[Connection closed]\x1b[0m\r\n');
		};

		term.onData((data: string) => {
			if (ws?.readyState === WebSocket.OPEN) {
				ws.send(data);
			}
		});

		resizeObserver = new ResizeObserver(() => {
			fitAddon?.fit();
			const dims = fitAddon?.proposeDimensions();
			if (dims && ws?.readyState === WebSocket.OPEN) {
				ws.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }));
			}
		});
		resizeObserver.observe(container);
	}

	function cleanup() {
		resizeObserver?.disconnect();
		ws?.close();
		term?.dispose();
	}

	// Re-fit when becoming visible (size may have changed while hidden)
	$effect(() => {
		if (visible && fitAddon) {
			// Tick delay so the container has its real dimensions
			requestAnimationFrame(() => fitAddon?.fit());
		}
	});
</script>

<div class="h-full w-full" class:hidden={!visible} bind:this={container}></div>
