<script lang="ts">
	import { currentWorktree, currentFile } from '$lib/stores';
	import { onMount } from 'svelte';
	import { Badge } from '$lib/components/ui/badge';
	import * as Breadcrumb from '$lib/components/ui/breadcrumb/index.js';

	let container: HTMLDivElement;
	let editor: any;
	let monaco: any;

	let fileContent: string = $state('');
	let language: string = $state('plaintext');
	let saving: boolean = $state(false);

	onMount(() => {
		initMonaco();
		return () => {
			editor?.dispose();
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

		editor = monaco.editor.create(container, {
			value: '',
			language: 'plaintext',
			theme: 'dashboard-dark',
			automaticLayout: true,
			minimap: { enabled: false },
			fontSize: 13,
			lineNumbers: 'on',
			scrollBeyondLastLine: false,
			padding: { top: 8 },
		});

		editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
			saveFile();
		});
	}

	async function loadFile(worktreePath: string, filePath: string) {
		const params = new URLSearchParams({ root: worktreePath, path: filePath });
		const res = await fetch(`/api/files?${params}`);
		const data = await res.json();
		if (data.error) return;

		fileContent = data.content;
		language = data.language;

		if (editor && monaco) {
			const model = editor.getModel();
			if (model) {
				model.setValue(data.content);
				monaco.editor.setModelLanguage(model, data.language);
			}
		}
	}

	async function saveFile() {
		if (!$currentWorktree || !$currentFile || !editor) return;
		saving = true;
		const content = editor.getValue();
		const params = new URLSearchParams({ root: $currentWorktree.path, path: $currentFile });
		await fetch(`/api/files?${params}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ content }),
		});
		saving = false;
	}

	$effect(() => {
		const wt = $currentWorktree;
		const file = $currentFile;
		if (wt && file) {
			loadFile(wt.path, file);
		}
	});
</script>

<div class="flex h-full flex-col">
	{#if $currentFile}
		<div class="flex items-center justify-between border-b border-border px-3 py-1.5 text-xs">
			<Breadcrumb.Root>
				<Breadcrumb.List class="text-xs sm:gap-1">
					{#each $currentFile.split('/') as part, i}
						{#if i > 0}
							<Breadcrumb.Separator />
						{/if}
						<Breadcrumb.Item>
							{#if i === $currentFile.split('/').length - 1}
								<Breadcrumb.Page>{part}</Breadcrumb.Page>
							{:else}
								<Breadcrumb.Link href="##">{part}</Breadcrumb.Link>
							{/if}
						</Breadcrumb.Item>
					{/each}
				</Breadcrumb.List>
			</Breadcrumb.Root>
			{#if saving}
				<Badge variant="outline" class="text-[10px]">Saving...</Badge>
			{:else}
				<span class="text-muted-foreground/60">{language}</span>
			{/if}
		</div>
	{/if}
	{#if !$currentFile}
		<div class="flex flex-1 items-center justify-center text-muted-foreground text-sm">
			Select a file to edit
		</div>
	{/if}
	<div class="flex-1" class:hidden={!$currentFile} bind:this={container}></div>
</div>
