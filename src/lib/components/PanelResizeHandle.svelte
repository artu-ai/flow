<script lang="ts">
	let {
		onresize,
		orientation = 'vertical',
	}: {
		onresize: (delta: number) => void;
		orientation?: 'vertical' | 'horizontal';
	} = $props();

	let dragging = $state(false);
	let lastPos = 0;

	function onpointerdown(e: PointerEvent) {
		e.preventDefault();
		dragging = true;
		lastPos = orientation === 'vertical' ? e.clientX : e.clientY;
		document.addEventListener('pointermove', onpointermove);
		document.addEventListener('pointerup', onpointerup);
	}

	function onpointermove(e: PointerEvent) {
		const pos = orientation === 'vertical' ? e.clientX : e.clientY;
		const delta = pos - lastPos;
		lastPos = pos;
		onresize(delta);
	}

	function onpointerup() {
		dragging = false;
		document.removeEventListener('pointermove', onpointermove);
		document.removeEventListener('pointerup', onpointerup);
	}
</script>

{#if dragging}
	<div class="fixed inset-0 z-50 {orientation === 'vertical' ? 'cursor-col-resize' : 'cursor-row-resize'}"></div>
{/if}

{#if orientation === 'vertical'}
	<div
		role="separator"
		aria-orientation="vertical"
		tabIndex={-1}
		onpointerdown={onpointerdown}
		class="flex w-2 shrink-0 cursor-col-resize items-center justify-center border-l-2 border-border/50 hover:bg-sidebar-border/50 active:bg-ring/30 transition-colors {dragging ? 'bg-ring/30' : ''}"
	></div>
{:else}
	<div
		role="separator"
		aria-orientation="horizontal"
		tabIndex={-1}
		onpointerdown={onpointerdown}
		class="flex h-2 shrink-0 cursor-row-resize items-center justify-center border-t-2 border-border/50 hover:bg-sidebar-border/50 active:bg-ring/30 transition-colors {dragging ? 'bg-ring/30' : ''}"
	></div>
{/if}
