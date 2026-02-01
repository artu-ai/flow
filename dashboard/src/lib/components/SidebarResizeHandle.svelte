<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { useSidebar } from '$lib/components/ui/sidebar/context.svelte.js';

	let { onresize }: { onresize: (width: number) => void } = $props();

	const sidebar = useSidebar();

	const MIN_WIDTH = 180;
	const MAX_WIDTH = 480;

	let dragging = $state(false);
	let startX = 0;
	let startWidth = 0;

	function onpointerdown(e: PointerEvent) {
		if (!sidebar.open) {
			sidebar.toggle();
			return;
		}
		e.preventDefault();
		dragging = true;
		startX = e.clientX;
		const sidebarEl = document.querySelector('[data-slot="sidebar-container"]');
		startWidth = sidebarEl?.getBoundingClientRect().width ?? 256;
		document.querySelector('[data-slot="sidebar-wrapper"]')?.setAttribute('data-resizing', '');
		document.addEventListener('pointermove', onpointermove);
		document.addEventListener('pointerup', onpointerup);
	}

	function onpointermove(e: PointerEvent) {
		const delta = e.clientX - startX;
		const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta));
		onresize(newWidth);
	}

	function onpointerup() {
		dragging = false;
		document.querySelector('[data-slot="sidebar-wrapper"]')?.removeAttribute('data-resizing');
		document.removeEventListener('pointermove', onpointermove);
		document.removeEventListener('pointerup', onpointerup);
	}

	function ondblclick() {
		sidebar.toggle();
	}
</script>

{#if dragging}
	<div class="fixed inset-0 z-50 cursor-col-resize"></div>
{/if}

<button
	data-slot="sidebar-resize-handle"
	aria-label="Resize Sidebar"
	tabIndex={-1}
	{onpointerdown}
	{ondblclick}
	class={cn(
		'absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear group-data-[side=left]:-end-4 sm:flex items-center justify-center',
		'cursor-col-resize select-none',
		'group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:start-full',
		'[[data-side=left][data-collapsible=offcanvas]_&]:-end-2',
		dragging
			? 'after:absolute after:inset-y-0 after:start-[calc(1/2*100%-1px)] after:w-[2px] after:bg-ring'
			: 'after:absolute after:inset-y-0 after:start-[calc(1/2*100%-1px)] after:w-[2px] hover:after:bg-sidebar-border'
	)}
></button>
