<script lang="ts">
	import { currentWorktree, worktrees, terminalSessions, activeTerminalSession, focusedPanel, terminalChatInputEnabled } from '$lib/stores';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import { Kbd } from '$lib/components/ui/kbd';
	import TerminalSquareIcon from '@lucide/svelte/icons/terminal';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import XIcon from '@lucide/svelte/icons/x';
	import SendIcon from '@lucide/svelte/icons/send-horizontal';
	import TerminalInstance from './TerminalInstance.svelte';
	import { IsPhone } from '$lib/hooks/is-mobile.svelte.js';

	const isPhone = new IsPhone();

	// Chat input is active if setting is enabled OR on phone (auto-enabled)
	let chatInputActive = $derived(isPhone.current || $terminalChatInputEnabled);

	// Refs to TerminalInstance components by sessionId
	let instanceRefs: Record<string, TerminalInstance> = {};

	/** Focus the currently active terminal instance (or chat input if active). Called by parent on worktree switch. */
	export function focusActive() {
		if (chatInputActive && chatTextareaRef) {
			chatTextareaRef.focus();
			return;
		}
		const path = $currentWorktree?.path;
		if (!path) return;
		const sid = $activeTerminalSession[path];
		if (sid && instanceRefs[sid]) {
			instanceRefs[sid].focus();
		}
	}

	/** Close the currently active terminal session. */
	export function closeActive() {
		const path = $currentWorktree?.path;
		if (!path) return;
		const sid = $activeTerminalSession[path];
		if (sid) closeSession(sid);
	}

	/** Navigate to the terminal that sent the most recent notification. */
	export function goToLastNotification() {
		if (!lastNotification) return;
		navigateToTerminal(lastNotification.sessionId, lastNotification.worktreePath);
	}

	function handleTerminalFocus(worktreePath: string) {
		focusedPanel.update((s) => ({ ...s, [worktreePath]: 'terminal' }));
	}

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
	// Sessions with unread notification indicator (dot on tab)
	let unreadSessions: Set<string> = $state(new Set());
	// Cooldown: suppress notifications briefly after visiting a terminal
	let notificationCooldowns: Record<string, number> = {};
	// Most recent notification source for keybinding navigation
	let lastNotification: { sessionId: string; worktreePath: string } | null = null;

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

	export async function createSession() {
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
				// Focus the newly created terminal (or chat input if active) once it mounts
				// Double RAF to ensure DOM has updated (especially for first terminal when chat input renders)
				requestAnimationFrame(() => {
					requestAnimationFrame(() => {
						if (chatInputActive && chatTextareaRef) {
							chatTextareaRef.focus();
						} else {
							instanceRefs[data.id]?.focus();
						}
					});
				});
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

		// Clean up label, rename, and notification tracking
		delete sessionLabels[sessionId];
		manuallyRenamed.delete(sessionId);
		delete notificationCooldowns[sessionId];
		if (unreadSessions.has(sessionId)) {
			unreadSessions = new Set([...unreadSessions].filter((id) => id !== sessionId));
		}

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
		// Focus the newly active terminal (or chat input if active) after it becomes visible
		requestAnimationFrame(() => {
			if (chatInputActive && chatTextareaRef) {
				chatTextareaRef.focus();
			} else {
				instanceRefs[sessionId]?.focus();
			}
		});
	}

	function navigateToTerminal(sessionId: string, worktreePath: string) {
		// Switch worktree if needed
		if ($currentWorktree?.path !== worktreePath) {
			const wt = $worktrees.find((w) => w.path === worktreePath);
			if (wt) currentWorktree.set(wt);
		}
		// Switch to the terminal tab
		activeTerminalSession.update((s) => ({ ...s, [worktreePath]: sessionId }));
	}

	function handleNotification(sessionId: string, worktreePath: string, { title, body }: { title?: string; body: string }) {
		// Don't show toast if this terminal is already active and visible
		if (sessionId === activeSession && worktreePath === $currentWorktree?.path) return;
		// Suppress notifications briefly after the user visited this terminal
		const cooldownUntil = notificationCooldowns[sessionId] ?? 0;
		if (Date.now() < cooldownUntil) return;
		// Don't fire duplicate toasts — wait until the user navigates to this terminal
		if (unreadSessions.has(sessionId)) return;

		unreadSessions = new Set([...unreadSessions, sessionId]);
		lastNotification = { sessionId, worktreePath };

		const label = sessionLabels[sessionId] ?? 'Terminal';
		toast(title ?? label, {
			description: body,
			action: {
				label: 'Go to terminal',
				onClick: () => navigateToTerminal(sessionId, worktreePath),
			},
		});
	}

	// Clear notification indicator when a session becomes active, and start cooldown
	$effect(() => {
		if (activeSession) {
			if (unreadSessions.has(activeSession)) {
				unreadSessions = new Set([...unreadSessions].filter((id) => id !== activeSession));
			}
			// Suppress re-notifications for 3s after visiting a terminal
			notificationCooldowns[activeSession] = Date.now() + 3000;
		}
	});

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

	// Chat input state
	let chatInput = $state('');
	let chatTextareaRef = $state<HTMLTextAreaElement | null>(null);

	function getActiveInstance() {
		const path = $currentWorktree?.path;
		if (!path) return null;
		const sid = $activeTerminalSession[path];
		return sid ? instanceRefs[sid] : null;
	}

	function sendChatInput() {
		const instance = getActiveInstance();
		if (!instance || !chatInput) return;
		// Send all text to terminal, then Enter key
		instance.write(chatInput);
		instance.write('\r');
		chatInput = '';
		// Refocus the chat input and reset height
		if (chatTextareaRef) {
			chatTextareaRef.style.height = 'auto';
			chatTextareaRef.focus();
		}
	}

	function autoResizeTextarea() {
		if (!chatTextareaRef) return;
		chatTextareaRef.style.height = 'auto';
		chatTextareaRef.style.height = `${Math.min(chatTextareaRef.scrollHeight, 150)}px`;
	}

	// Check if we're in "slash mode" - first char is /
	let isSlashMode = $derived(chatInput.startsWith('/'));

	function handleChatKeydown(e: KeyboardEvent) {
		const instance = getActiveInstance();

		// In slash mode, forward Tab and Arrow keys to terminal
		if (isSlashMode && instance) {
			if (e.key === 'Tab') {
				e.preventDefault();
				instance.write('\t');
				// Clear chat since terminal will autocomplete
				chatInput = '';
				if (chatTextareaRef) {
					chatTextareaRef.style.height = 'auto';
				}
				return;
			}
			if (e.key === 'ArrowUp') {
				e.preventDefault();
				instance.write('\x1b[A');
				return;
			}
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				instance.write('\x1b[B');
				return;
			}
			if (e.key === 'ArrowRight') {
				e.preventDefault();
				instance.write('\x1b[C');
				return;
			}
			if (e.key === 'ArrowLeft') {
				e.preventDefault();
				instance.write('\x1b[D');
				return;
			}
		}

		if (isPhone.current) {
			// Phone mode: Enter adds newline (send via button only)
			// Unless in slash mode, then Enter sends
			if (isSlashMode && e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				sendSlashCommand();
			}
		} else {
			// Desktop/iPad mode
			if (e.key === 'Enter') {
				if (e.shiftKey) {
					// Shift+Enter: add newline to textarea (default behavior)
				} else {
					// Enter: send Enter to terminal and clear
					e.preventDefault();
					if (isSlashMode) {
						sendSlashCommand();
					} else {
						sendChatInput();
					}
				}
			}
		}
	}

	function handleChatBeforeInput(e: InputEvent) {
		// In slash mode, send all input immediately to terminal
		if (!isSlashMode && !(chatInput === '' && e.data?.startsWith('/'))) return;

		const instance = getActiveInstance();
		if (!instance) return;

		// Handle character insertion
		if (e.inputType === 'insertText' || e.inputType === 'insertFromPaste') {
			if (e.data) {
				instance.write(e.data);
			}
		}
		// Handle backspace/delete
		else if (e.inputType === 'deleteContentBackward') {
			instance.write('\x7f'); // DEL character (backspace)
		}
		else if (e.inputType === 'deleteContentForward') {
			instance.write('\x1b[3~'); // Delete key escape sequence
		}
	}

	function sendSlashCommand() {
		const instance = getActiveInstance();
		if (!instance) return;
		// Just send Enter - characters were already sent
		instance.write('\r');
		chatInput = '';
		// Reset textarea height and refocus
		if (chatTextareaRef) {
			chatTextareaRef.style.height = 'auto';
			chatTextareaRef.focus();
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
	@media (pointer: coarse) {
		:global(.xterm-viewport) {
			scrollbar-width: auto;
		}
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
				class="max-w-full"
			>
				<span class="truncate">Open Terminal{$currentWorktree ? ` in ${$currentWorktree.branch}` : ''}</span>
			</Button>
			{#if error}
				<p class="text-xs text-destructive max-w-64 text-center">{error}</p>
			{/if}
		</div>
	{:else}
		<!-- Tab bar -->
		<div class="flex h-8 shrink-0 items-center border-b border-border bg-muted/30 px-1 gap-0.5 overflow-x-auto">
			{#if currentSessions.length > 1}
				<Kbd class="h-4 min-w-4 text-[10px] opacity-50" title="Ctrl+Shift+[ — previous terminal">⌃⇧[</Kbd>
			{/if}
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
						{#if unreadSessions.has(sessionId)}
							<span class="size-1.5 rounded-full bg-blue-400"></span>
						{/if}
						{sessionLabels[sessionId] ?? `Terminal ${i + 1}`}
						{#if i < 9}
							<Kbd class="ml-0.5 h-4 min-w-4 text-[10px] opacity-40">⌃⇧{i + 1}</Kbd>
						{/if}
					{/if}
					<span
						role="button"
						tabindex="-1"
						class="ml-0.5 rounded-sm opacity-60 hover:opacity-100 hover:bg-muted-foreground/20"
						onclick={(e: MouseEvent) => { e.stopPropagation(); closeSession(sessionId); }}
						onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter') { e.stopPropagation(); closeSession(sessionId); } }}
					>
						<XIcon class="h-3 w-3" />
					</span>
				</button>
			{/each}
			{#if currentSessions.length > 1}
				<Kbd class="h-4 min-w-4 text-[10px] opacity-50" title="Ctrl+Shift+] — next terminal">⌃⇧]</Kbd>
			{/if}
			<button
				class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted"
				onclick={createSession}
				title="New terminal (Ctrl+Shift+T)"
			>
				<PlusIcon class="h-3.5 w-3.5" />
			</button>
			<Kbd class="h-4 min-w-4 text-[10px] opacity-50" title="Ctrl+Shift+T — new terminal">⌃⇧T</Kbd>
		</div>
		{#if error}
			<p class="text-xs text-destructive px-2 py-1">{error}</p>
		{/if}
	{/if}
	{#each allSessions as { worktreePath, sessionId } (sessionId)}
		<TerminalInstance
			bind:this={instanceRefs[sessionId]}
			{sessionId}
			visible={worktreePath === $currentWorktree?.path && sessionId === activeSession}
			readOnly={chatInputActive}
			ontitlechange={(title) => handleTitleChange(sessionId, title)}
			onnotification={(data) => handleNotification(sessionId, worktreePath, data)}
			onfocus={() => handleTerminalFocus(worktreePath)}
		/>
	{/each}
	{#if currentSessions.length > 0 && chatInputActive}
		<div class="shrink-0 border-t border-border bg-muted/30 p-2">
			<div class="flex gap-2">
				<textarea
					bind:this={chatTextareaRef}
					bind:value={chatInput}
					onkeydown={handleChatKeydown}
					onbeforeinput={handleChatBeforeInput}
					oninput={autoResizeTextarea}
					placeholder={isPhone.current ? "Type here..." : "Type here... (Enter to send, Shift+Enter for newline)"}
					rows="1"
					class="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring min-h-[38px] max-h-[150px] overflow-y-auto"
				></textarea>
				<Button
					variant="default"
					size="icon"
					class="shrink-0"
					onclick={sendChatInput}
					disabled={!chatInput}
				>
					<SendIcon class="h-4 w-4" />
				</Button>
			</div>
		</div>
	{/if}
</div>
