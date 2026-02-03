<script lang="ts">
	import { onMount } from 'svelte';

	let { sessionId, visible, readOnly = false, ontitlechange, onnotification, onfocus }: {
		sessionId: string;
		visible: boolean;
		readOnly?: boolean;
		ontitlechange?: (title: string) => void;
		onnotification?: (data: { title?: string; body: string }) => void;
		onfocus?: () => void;
	} = $props();

	let container: HTMLDivElement;
	let term = $state<any>(null);
	let fitAddon = $state<any>(null);
	let ws: WebSocket | null = null;
	let resizeObserver: ResizeObserver | null = null;

	// Idle detection for notifications
	const IDLE_THRESHOLD_MS = 10_000; // 10 seconds of no output = idle
	const MIN_OUTPUT_FOR_ACTIVITY = 50; // Require at least 50 chars of new output to count as "new activity"
	let lastOutputTime = 0;
	let outputSinceLastNotify = 0; // Track bytes of output since last notification
	let idleCheckInterval: ReturnType<typeof setInterval> | null = null;
	let hasNotifiedIdle = false;

	// Track readOnly state for the key handler closure (use object so closure sees updates)
	let readOnlyRef = { value: readOnly };
	$effect(() => { readOnlyRef.value = readOnly; });

	export function focus() {
		term?.focus();
	}

	/** Send raw data (keystrokes) to the terminal. */
	export function write(data: string) {
		if (ws?.readyState === WebSocket.OPEN) {
			ws.send(data);
		}
	}

	/** Trigger xterm's onData handler as if user typed (for TUI apps that need it). */
	export function triggerInput(data: string) {
		if (ws?.readyState === WebSocket.OPEN) {
			// Send each character individually with a tiny delay for TUI apps
			for (let i = 0; i < data.length; i++) {
				ws.send(data[i]);
			}
		}
	}

	function checkIdle() {
		const now = Date.now();
		const timeSinceOutput = now - lastOutputTime;

		// Only notify if:
		// 1. We've been idle for the threshold
		// 2. We haven't already notified for this idle period
		// 3. There was meaningful output since the last notification
		if (
			timeSinceOutput >= IDLE_THRESHOLD_MS &&
			!hasNotifiedIdle &&
			outputSinceLastNotify >= MIN_OUTPUT_FOR_ACTIVITY
		) {
			hasNotifiedIdle = true;
			outputSinceLastNotify = 0;
			onnotification?.({ body: 'Terminal idle' });
		}
	}

	function recordOutput(data: string) {
		const now = Date.now();
		lastOutputTime = now;

		// Accumulate output - this tracks "new activity" since last notification
		outputSinceLastNotify += data.length;

		// Reset notification flag when new meaningful output arrives after being idle
		if (hasNotifiedIdle && outputSinceLastNotify >= MIN_OUTPUT_FOR_ACTIVITY) {
			hasNotifiedIdle = false;
		}
	}

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
			recordOutput(event.data);
			term.write(event.data);
		};

		ws.onclose = () => {
			term?.write('\r\n\x1b[31m[Connection closed]\x1b[0m\r\n');
		};

		term.onTitleChange((title: string) => {
			ontitlechange?.(title);
		});

		// Track when xterm's textarea gets focus
		const textarea = container.querySelector('textarea');
		if (textarea) {
			textarea.addEventListener('focus', () => onfocus?.());
		}

		// Prevent Escape (and other terminal keys) from bubbling to page-level
		// handlers — e.g. bits-ui dialogs that close on Escape. xterm still
		// processes the key normally because we return true.
		// When readOnly is true, block all keyboard input except copy and Escape.
		term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
			if (event.key === 'Escape') event.stopPropagation();
			if (readOnlyRef.value) {
				// Allow Ctrl+C (copy) and Ctrl+Shift+C
				if (event.ctrlKey && (event.key === 'c' || event.key === 'C')) {
					return true;
				}
				// Allow Escape (important for Claude Code and other TUI apps)
				if (event.key === 'Escape') {
					return true;
				}
				// Block all other keyboard input
				return false;
			}
			return true;
		});

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

		// Start idle detection
		idleCheckInterval = setInterval(checkIdle, 1000);

		// Focus immediately if this instance is already visible at init time
		if (visible) {
			term.focus();
		}
	}

	function cleanup() {
		if (idleCheckInterval) {
			clearInterval(idleCheckInterval);
			idleCheckInterval = null;
		}
		resizeObserver?.disconnect();
		ws?.close();
		term?.dispose();
	}

	// Re-fit and focus when becoming visible (size may have changed while hidden)
	$effect(() => {
		if (visible && fitAddon) {
			// Tick delay so the container has its real dimensions
			requestAnimationFrame(() => {
				fitAddon?.fit();
				term?.scrollToBottom();
				// Don't auto-focus if readOnly (chat input mode) - parent handles focus
				if (!readOnlyRef.value) {
					term?.focus();
				}
			});
		}
	});
</script>

<div class="h-full w-full" class:hidden={!visible} bind:this={container}></div>
