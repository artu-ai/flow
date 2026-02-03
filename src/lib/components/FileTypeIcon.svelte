<script lang="ts">
	import { getIcon } from 'material-file-icons';

	let { filename }: { filename: string } = $props();

	let svg = $derived(getIcon(filename).svg);
</script>

<span class="inline-flex size-4 shrink-0 items-center justify-center [&>svg]:size-4">
	{@html svg}
</span>
