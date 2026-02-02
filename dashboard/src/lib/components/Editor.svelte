<script lang="ts">
	import { currentFile, activeView, diffBase, hasUnsavedChanges, focusedPanel } from '$lib/stores';
	import { onMount } from 'svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import FileBreadcrumb from './FileBreadcrumb.svelte';

	let { worktreePath }: { worktreePath: string } = $props();

	let editorContainer: HTMLDivElement;
	let diffContainer: HTMLDivElement;
	let editor: any;
	let diffEditor: any;
	let monaco: any;
	let monacoReady: Promise<void>;

	let language: string = $state('plaintext');
	let saving: boolean = $state(false);

	let filePath = $derived($currentFile[worktreePath] ?? null);
	let unsaved = $derived($hasUnsavedChanges[worktreePath] ?? false);

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
			hasUnsavedChanges.update((s) => ({ ...s, [worktreePath]: true }));
		});

		editor.onDidFocusEditorWidget(() => {
			focusedPanel.update((s) => ({ ...s, [worktreePath]: 'editor' }));
		});
	}

	/** Focus the Monaco editor. Called by parent on worktree switch. */
	export function focus() {
		editor?.focus();
	}

	async function loadFile(file: string) {
		await monacoReady;
		const params = new URLSearchParams({ root: worktreePath, path: file });
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
			hasUnsavedChanges.update((s) => ({ ...s, [worktreePath]: false }));
		}
	}

	async function loadDiff(file: string, base: string) {
		await monacoReady;
		if (!monaco || !diffContainer) return;

		const params = new URLSearchParams({ worktree: worktreePath, file, base });
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

		const originalModel = monaco.editor.createModel(data.original ?? '', undefined, monaco.Uri.parse(`original/${file}`));
		const modifiedModel = monaco.editor.createModel(data.modified ?? '', undefined, monaco.Uri.parse(`modified/${file}`));

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
		if (!filePath || !editor) return;
		saving = true;
		const content = editor.getValue();
		const params = new URLSearchParams({ root: worktreePath, path: filePath });
		await fetch(`/api/files?${params}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ content }),
		});
		saving = false;
		hasUnsavedChanges.update((s) => ({ ...s, [worktreePath]: false }));
	}

	$effect(() => {
		const file = filePath;
		if (file && $activeView === 'editor') {
			loadFile(file);
		}
	});

	$effect(() => {
		const file = filePath;
		const base = $diffBase;
		if (file && $activeView === 'diff') {
			loadDiff(file, base);
		}
	});
</script>

<div class="flex h-full flex-col">
	{#if filePath}
		<FileBreadcrumb filePath={filePath}>
			{#if $activeView === 'diff'}
				<Badge variant="outline" class="text-[10px]">
					{$diffBase === 'main' ? 'vs main' : 'vs HEAD'}
				</Badge>
			{:else if saving}
				<Badge variant="outline" class="text-[10px]">Saving...</Badge>
			{:else if unsaved}
				<Button variant="ghost" size="sm" class="h-5 px-1.5 text-[10px]" onclick={saveFile}>Save</Button>
			{:else}
				<span class="text-muted-foreground/60">{language}</span>
			{/if}
		</FileBreadcrumb>
	{/if}
	{#if !filePath}
		<div class="flex flex-1 items-center justify-center text-muted-foreground text-sm">
			Select a file to edit
		</div>
	{/if}
	<div class="flex-1" class:hidden={!filePath || $activeView !== 'editor'} bind:this={editorContainer}></div>
	<div class="flex-1" class:hidden={!filePath || $activeView !== 'diff'} bind:this={diffContainer}></div>
</div>
