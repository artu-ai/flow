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
	let oscDisposables: { dispose: () => void }[] = [];

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

		term.onTitleChange((title: string) => {
			ontitlechange?.(title);
		});

		// Bell (BEL character \x07)
		oscDisposables.push(
			term.onBell(() => {
				onnotification?.({ body: 'Bell' });
			})
		);

		// iTerm2 / ConEmu notifications: OSC 9 ; message ST
		// Sub-command 4 is the progress indicator: "4;state;progress"
		//   state 0 = hidden (task finished), 1 = normal, 2 = error, 3 = indeterminate
		oscDisposables.push(
			term.parser.registerOscHandler(9, (data: string) => {
				if (data.startsWith('4;')) {
					const state = parseInt(data.split(';')[1]);
					if (state === 0) onnotification?.({ body: 'Finished' });
				} else {
					onnotification?.({ body: data });
				}
				return true;
			})
		);

		// URxvt notifications: OSC 777 ; notify ; title ; body ST
		oscDisposables.push(
			term.parser.registerOscHandler(777, (data: string) => {
				const parts = data.split(';');
				if (parts[0] === 'notify' && parts.length >= 3) {
					onnotification?.({ title: parts[1], body: parts.slice(2).join(';') });
				}
				return true;
			})
		);

		// Kitty notifications: OSC 99 ; metadata ; message ST
		oscDisposables.push(
			term.parser.registerOscHandler(99, (data: string) => {
				const idx = data.indexOf(';');
				if (idx !== -1) {
					onnotification?.({ body: data.slice(idx + 1) });
				} else {
					onnotification?.({ body: data });
				}
				return true;
			})
		);

		// Track when xterm's textarea gets focus
		const textarea = container.querySelector('textarea');
		if (textarea) {
			textarea.addEventListener('focus', () => onfocus?.());
		}

		// Prevent Escape (and other terminal keys) from bubbling to page-level
		// handlers — e.g. bits-ui dialogs that close on Escape. xterm still
		// processes the key normally because we return true.
		// When readOnly is true, block all keyboard input except copy (Ctrl+C on selection).
		term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
			if (event.key === 'Escape') event.stopPropagation();
			if (readOnlyRef.value) {
				// Allow Ctrl+C (copy) and Ctrl+Shift+C
				if (event.ctrlKey && (event.key === 'c' || event.key === 'C')) {
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

		// Focus immediately if this instance is already visible at init time
		if (visible) {
			term.focus();
		}
	}

	function cleanup() {
		for (const d of oscDisposables) d.dispose();
		oscDisposables = [];
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
