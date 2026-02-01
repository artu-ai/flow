<script lang="ts">
	let { onresize }: { onresize: (delta: number) => void } = $props();

	let dragging = $state(false);
	let lastX = 0;

	function onpointerdown(e: PointerEvent) {
		e.preventDefault();
		dragging = true;
		lastX = e.clientX;
		document.addEventListener('pointermove', onpointermove);
		document.addEventListener('pointerup', onpointerup);
	}

	function onpointermove(e: PointerEvent) {
		const delta = e.clientX - lastX;
		lastX = e.clientX;
		onresize(delta);
	}

	function onpointerup() {
		dragging = false;
		document.removeEventListener('pointermove', onpointermove);
		document.removeEventListener('pointerup', onpointerup);
	}
</script>

{#if dragging}
	<div class="fixed inset-0 z-50 cursor-col-resize"></div>
{/if}

<div
	role="separator"
	aria-orientation="vertical"
	tabIndex={-1}
	onpointerdown={onpointerdown}
	class="flex w-2 shrink-0 cursor-col-resize items-center justify-center border-l-2 border-border/50 hover:bg-sidebar-border/50 active:bg-ring/30 transition-colors {dragging ? 'bg-ring/30' : ''}"
></div>
