<script lang="ts">
	import '../app.css';
	import { Toaster } from '$lib/components/ui/sonner';
	import { currentWorktree, worktrees, selectedWorktreePath, loadGlobalConfig } from '$lib/stores';
	import type { Worktree } from '$lib/stores';
	import { onMount } from 'svelte';

	let { children } = $props();

	async function fetchWorktrees() {
		const res = await fetch('/api/worktrees');
		const data: Worktree[] = await res.json();
		worktrees.set(data);
		if (data.length > 0) {
			const saved = $selectedWorktreePath;
			const match = saved ? data.find((w) => w.path === saved) : null;
			currentWorktree.set(match ?? data[0]);
		}
	}

	// Persist selected worktree path whenever it changes
	$effect(() => {
		if ($currentWorktree) {
			selectedWorktreePath.set($currentWorktree.path);
		}
	});

	onMount(() => {
		loadGlobalConfig();
		fetchWorktrees();
	});
</script>

<Toaster position="top-right" />
<div class="flex h-dvh flex-col overflow-hidden" style="overscroll-behavior: none">
	{@render children()}
</div>
