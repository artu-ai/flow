<script lang="ts">
	import { currentWorktree, currentFile, activeView, diffBase, hasUnsavedChanges } from '$lib/stores';
	import { onMount } from 'svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import FileBreadcrumb from './FileBreadcrumb.svelte';

	let editorContainer: HTMLDivElement;
	let diffContainer: HTMLDivElement;
	let editor: any;
	let diffEditor: any;
	let monaco: any;
	let monacoReady: Promise<void>;

	let language: string = $state('plaintext');
	let saving: boolean = $state(false);

	onMount(() => {
		monacoReady = initMonaco();
		return () => {
			editor?.dispose();
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

		editor = monaco.editor.create(editorContainer, {
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

		editor.onDidChangeModelContent(() => {
			hasUnsavedChanges.set(true);
		});
	}

	async function loadFile(worktreePath: string, filePath: string) {
		await monacoReady;
		const params = new URLSearchParams({ root: worktreePath, path: filePath });
		const res = await fetch(`/api/files?${params}`);
		const data = await res.json();
		if (data.error) return;

		language = data.language;

		if (editor && monaco) {
			const model = editor.getModel();
			if (model) {
				model.setValue(data.content);
				monaco.editor.setModelLanguage(model, data.language);
			}
			hasUnsavedChanges.set(false);
		}
	}

	async function loadDiff(worktreePath: string, filePath: string, base: string) {
		await monacoReady;
		if (!monaco || !diffContainer) return;

		const params = new URLSearchParams({ worktree: worktreePath, file: filePath, base });
		const res = await fetch(`/api/git/diff?${params}`);
		const data = await res.json();
		if (data.error) return;

		if (diffEditor) {
			const model = diffEditor.getModel();
			model?.original?.dispose();
			model?.modified?.dispose();
			diffEditor.dispose();
			diffEditor = null;
		}

		const originalModel = monaco.editor.createModel(data.original ?? '', undefined, monaco.Uri.parse(`original/${filePath}`));
		const modifiedModel = monaco.editor.createModel(data.modified ?? '', undefined, monaco.Uri.parse(`modified/${filePath}`));

		diffEditor = monaco.editor.createDiffEditor(diffContainer, {
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
		hasUnsavedChanges.set(false);
	}

	$effect(() => {
		const wt = $currentWorktree;
		const file = $currentFile;
		if (wt && file && $activeView === 'editor') {
			loadFile(wt.path, file);
		}
	});

	$effect(() => {
		const wt = $currentWorktree;
		const file = $currentFile;
		const base = $diffBase;
		if (wt && file && $activeView === 'diff') {
			loadDiff(wt.path, file, base);
		}
	});
</script>

<div class="flex h-full flex-col">
	{#if $currentFile}
		<FileBreadcrumb filePath={$currentFile}>
			{#if $activeView === 'diff'}
				<Badge variant="outline" class="text-[10px]">
					{$diffBase === 'main' ? 'vs main' : 'vs HEAD'}
				</Badge>
			{:else if saving}
				<Badge variant="outline" class="text-[10px]">Saving...</Badge>
			{:else if $hasUnsavedChanges}
				<Button variant="ghost" size="sm" class="h-5 px-1.5 text-[10px]" onclick={saveFile}>Save</Button>
			{:else}
				<span class="text-muted-foreground/60">{language}</span>
			{/if}
		</FileBreadcrumb>
	{/if}
	{#if !$currentFile}
		<div class="flex flex-1 items-center justify-center text-muted-foreground text-sm">
			Select a file to edit
		</div>
	{/if}
	<div class="flex-1" class:hidden={!$currentFile || $activeView !== 'editor'} bind:this={editorContainer}></div>
	<div class="flex-1" class:hidden={!$currentFile || $activeView !== 'diff'} bind:this={diffContainer}></div>
</div>
