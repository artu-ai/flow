<script lang="ts">
	import { onMount, tick } from 'svelte';

	let {
		value: initialValue = '',
		selectStem = false,
		onconfirm,
		oncancel
	}: {
		value?: string;
		selectStem?: boolean;
		onconfirm: (value: string) => void;
		oncancel: () => void;
	} = $props();

	let inputEl: HTMLInputElement | undefined = $state();
	let currentValue = $state(initialValue);
	let confirmed = false;

	onMount(async () => {
		await tick();
		if (!inputEl) return;
		inputEl.focus();
		if (selectStem && initialValue.includes('.')) {
			const dotIndex = initialValue.lastIndexOf('.');
			inputEl.setSelectionRange(0, dotIndex);
		} else {
			inputEl.select();
		}
	});

	function confirm() {
		if (confirmed) return;
		const trimmed = currentValue.trim();
		if (!trimmed || trimmed === initialValue) {
			cancel();
			return;
		}
		confirmed = true;
		onconfirm(trimmed);
	}

	function cancel() {
		if (confirmed) return;
		confirmed = true;
		oncancel();
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			confirm();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			cancel();
		}
	}
</script>

<input
	bind:this={inputEl}
	bind:value={currentValue}
	{onkeydown}
	onblur={confirm}
	class="h-7 w-full rounded-sm border border-sidebar-accent bg-sidebar px-2 text-sm text-sidebar-foreground outline-none focus:border-ring"
/>
