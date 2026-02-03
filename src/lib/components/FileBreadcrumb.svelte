<script lang="ts">
	import * as Breadcrumb from '$lib/components/ui/breadcrumb/index.js';
	import FileTypeIcon from './FileTypeIcon.svelte';
	import type { Snippet } from 'svelte';

	let { filePath, children }: { filePath: string; children?: Snippet } = $props();

	let parts = $derived(filePath.split('/'));
	let filename = $derived(parts[parts.length - 1]);
</script>

<div class="flex items-center justify-between border-b border-border px-3 py-1.5 text-xs">
	<div class="flex items-center gap-1.5">
		<FileTypeIcon {filename} />
		<Breadcrumb.Root>
			<Breadcrumb.List class="text-xs sm:gap-1">
				{#each parts as part, i}
					{#if i > 0}
						<Breadcrumb.Separator />
					{/if}
					<Breadcrumb.Item>
						{#if i === parts.length - 1}
							<Breadcrumb.Page>{part}</Breadcrumb.Page>
						{:else}
							<Breadcrumb.Link href="##">{part}</Breadcrumb.Link>
						{/if}
					</Breadcrumb.Item>
				{/each}
			</Breadcrumb.List>
		</Breadcrumb.Root>
	</div>
	{#if children}
		{@render children()}
	{/if}
</div>
