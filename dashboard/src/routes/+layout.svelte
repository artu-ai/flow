<script lang="ts">
	import '../app.css';
	import { currentWorktree, worktrees } from '$lib/stores';
	import type { Worktree } from '$lib/stores';
	import { onMount } from 'svelte';

	let { children } = $props();

	async function fetchWorktrees() {
		const res = await fetch('/api/worktrees');
		const data: Worktree[] = await res.json();
		worktrees.set(data);
		if (data.length > 0 && !$currentWorktree) {
			currentWorktree.set(data[0]);
		}
	}

	onMount(() => {
		fetchWorktrees();
	});
</script>

<div class="flex h-screen flex-col overflow-hidden">
	{@render children()}
</div>
