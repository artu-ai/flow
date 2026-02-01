<script lang="ts">
	import { currentWorktree, currentFile, diffBase } from '$lib/stores';
	import { onMount } from 'svelte';

	let container: HTMLDivElement;
	let diffEditor: any;
	let monaco: any;
	let monacoPromise: Promise<any>;

	onMount(() => {
		monacoPromise = initMonaco();
		return () => {
			diffEditor?.getModel()?.original?.dispose();
			diffEditor?.getModel()?.modified?.dispose();
			diffEditor?.dispose();
		};
	});

	async function initMonaco() {
		monaco = await import('monaco-editor');

		monaco.editor.defineTheme('dashboard-dark', {
			base: 'vs-dark',
			inherit: true,
			rules: [],
			colors: {
				'editor.background': '#09090b',
			},
		});
	}

	async function showDiff(worktreePath: string, filePath: string, base: string) {
		await monacoPromise;
		if (!monaco || !container) return;

		const params = new URLSearchParams({ worktree: worktreePath, file: filePath, base });
		const res = await fetch(`/api/git/diff?${params}`);
		const data = await res.json();
		if (data.error) return;

		// Dispose previous editor and models
		if (diffEditor) {
			const model = diffEditor.getModel();
			model?.original?.dispose();
			model?.modified?.dispose();
			diffEditor.dispose();
			diffEditor = null;
		}

		const originalModel = monaco.editor.createModel(data.original ?? '', undefined);
		const modifiedModel = monaco.editor.createModel(data.modified ?? '', undefined);

		diffEditor = monaco.editor.createDiffEditor(container, {
			theme: 'dashboard-dark',
			automaticLayout: true,
			readOnly: true,
			minimap: { enabled: false },
			fontSize: 13,
			scrollBeyondLastLine: false,
			renderSideBySide: true,
		});

		diffEditor.setModel({ original: originalModel, modified: modifiedModel });
	}

	$effect(() => {
		const wt = $currentWorktree;
		const file = $currentFile;
		const base = $diffBase;
		if (wt && file) {
			showDiff(wt.path, file, base);
		}
	});
</script>

<div class="flex-1 h-full" bind:this={container}>
	{#if !$currentFile}
		<div class="flex h-full items-center justify-center text-muted-foreground text-sm">
			Select a changed file from the sidebar to view diff
		</div>
	{/if}
</div>
