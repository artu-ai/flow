<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { cn, type WithElementRef } from "$lib/utils.js";
	import { ScrollArea } from "$lib/components/ui/scroll-area/index.js";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLElement>> = $props();
</script>

<ScrollArea
	class={cn(
		"min-h-0 flex-1 group-data-[collapsible=icon]:overflow-hidden",
		className
	)}
>
	<div
		bind:this={ref}
		data-slot="sidebar-content"
		data-sidebar="content"
		{...restProps}
	>
		{@render children?.()}
	</div>
</ScrollArea>
