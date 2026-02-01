<script lang="ts">
	import EditorSidebar from '$lib/components/EditorSidebar.svelte';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import * as Tabs from '$lib/components/ui/tabs';
	import { Badge } from '$lib/components/ui/badge';
	import { currentWorktree, worktrees, terminalSessionId } from '$lib/stores';
	import Editor from '$lib/components/Editor.svelte';
	import Terminal from '$lib/components/Terminal.svelte';
	import PanelResizeHandle from '$lib/components/PanelResizeHandle.svelte';

	function handleWorktreeChange(value: string) {
		const wt = $worktrees.find((w) => w.path === value);
		if (wt) {
			currentWorktree.set(wt);
			terminalSessionId.set(null);
		}
	}

	let terminalOpen = $state(true);
	let sidebarWidth = $state(256);
	let terminalWidth = $state(480);

	const MIN_TERMINAL = 200;
	const MAX_TERMINAL = 800;

	function handleTerminalResize(delta: number) {
		terminalWidth = Math.min(MAX_TERMINAL, Math.max(MIN_TERMINAL, terminalWidth - delta));
	}
</script>

<div class="flex h-full">
	<!-- Left: sidebar + editor area -->
	<div class="flex min-w-0 flex-1">
		<Sidebar.Provider style="--sidebar-width: {sidebarWidth}px">
			<EditorSidebar onwidthchange={(w) => sidebarWidth = w} />
			<Sidebar.Inset class="overflow-hidden">
				<header class="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
					<Sidebar.Trigger class="-ms-1" />
					<Separator orientation="vertical" class="me-2 data-[orientation=vertical]:h-4" />

					{#if $worktrees.length > 0}
						<Tabs.Root value={$currentWorktree?.path ?? ''} onValueChange={handleWorktreeChange}>
							<Tabs.List>
								{#each $worktrees as wt}
									<Tabs.Trigger value={wt.path} class="gap-1.5">
										{wt.branch}
										{#if wt.issueId}
											<Badge variant="secondary" class="text-[10px] px-1 py-0">{wt.issueId}</Badge>
										{/if}
									</Tabs.Trigger>
								{/each}
							</Tabs.List>
						</Tabs.Root>
					{/if}
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
		<div class="flex h-full shrink-0 flex-col overflow-hidden" style="width: {terminalWidth}px">
			<Terminal />
		</div>
	{/if}
</div>
