<script lang="ts">
	import { currentFile, activeView, diffBase, hasUnsavedChanges, focusedPanel, completionConfig } from '$lib/stores';
	import type { CompletionConfig } from '$lib/stores';
	import { get } from 'svelte/store';
	import { onMount } from 'svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
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
	let completionLoading: boolean = $state(false);
	let suppressChangeHandler = false;
	let completionDisposable: any = null;

	let diagnostics: { severity: string }[] = $state([]);
	let errorCount = $derived(diagnostics.filter((d) => d.severity === 'error').length);
	let warningCount = $derived(diagnostics.filter((d) => d.severity === 'warning').length);

	let filePath = $derived($currentFile[worktreePath] ?? null);
	let unsaved = $derived($hasUnsavedChanges[worktreePath] ?? false);

	onMount(() => {
		monacoReady = initMonaco();
		return () => {
			completionDisposable?.dispose();
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
			inlineSuggest: { enabled: true },
		});

		editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
			saveFile();
		});

		editor.onDidChangeModelContent(() => {
			if (suppressChangeHandler) return;
			hasUnsavedChanges.update((s) => ({ ...s, [worktreePath]: true }));
			// Clear stale lint markers while editing
			const model = editor.getModel();
			if (model) monaco.editor.setModelMarkers(model, 'lint', []);
			diagnostics = [];
		});

		editor.onDidFocusEditorWidget(() => {
			focusedPanel.update((s) => ({ ...s, [worktreePath]: 'editor' }));
		});

		// Register inline completions provider
		completionDisposable = monaco.languages.registerInlineCompletionsProvider('*', {
			provideInlineCompletions: async (model: any, position: any, _ctx: any, token: any) => {
				const cfg: CompletionConfig = get(completionConfig);
				if (!cfg.activeProvider) return { items: [] };

				const fullText = model.getValue();
				const offset = model.getOffsetAt(position);
				const prefix = fullText.slice(Math.max(0, offset - 4000), offset);
				const suffix = fullText.slice(offset, offset + 1500);
				const langId = model.getLanguageId?.() ?? language;
				const file = filePath ?? 'untitled';

				const providerConfig = cfg.activeProvider === 'ollama'
					? cfg.ollama
					: cfg.claude;

				const controller = new AbortController();
				token.onCancellationRequested(() => controller.abort());

				completionLoading = true;
				try {
					const res = await fetch('/api/completions', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							provider: cfg.activeProvider,
							providerConfig,
							context: { prefix, suffix, language: langId, filename: file },
						}),
						signal: controller.signal,
					});
					if (!res.ok) return { items: [] };
					const data = await res.json();
					if (!data.text) return { items: [] };

					return {
						items: [
							{
								insertText: data.text,
								range: {
									startLineNumber: position.lineNumber,
									startColumn: position.column,
									endLineNumber: position.lineNumber,
									endColumn: position.column,
								},
							},
						],
					};
				} catch {
					return { items: [] };
				} finally {
					completionLoading = false;
				}
			},
			freeInlineCompletions: () => {},
		});
	}

	/** Focus the Monaco editor. Called by parent on worktree switch. */
	export function focus() {
		editor?.focus();
	}

	async function loadFile(file: string) {
		await monacoReady;

		// Clear stale markers and diagnostics
		if (editor && monaco) {
			const model = editor.getModel();
			if (model) monaco.editor.setModelMarkers(model, 'lint', []);
		}
		diagnostics = [];

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

		lintCurrentFile();
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
		let content = editor.getValue();

		// Format before saving
		try {
			const fmtRes = await fetch('/api/format', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ root: worktreePath, path: filePath, content }),
			});
			const fmtData = await fmtRes.json();
			if (fmtData.formatted && fmtData.content != null && fmtData.content !== content) {
				content = fmtData.content;
				const model = editor.getModel();
				if (model) {
					suppressChangeHandler = true;
					editor.executeEdits('format-on-save', [
						{
							range: model.getFullModelRange(),
							text: content,
						},
					]);
					suppressChangeHandler = false;
				}
			}
		} catch {
			suppressChangeHandler = false;
		}

		// Save (formatted) content to disk
		const params = new URLSearchParams({ root: worktreePath, path: filePath });
		await fetch(`/api/files?${params}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ content }),
		});

		saving = false;
		hasUnsavedChanges.update((s) => ({ ...s, [worktreePath]: false }));

		// Lint after save
		lintCurrentFile();
	}

	async function lintCurrentFile() {
		if (!filePath || !editor || !monaco) return;
		try {
			const res = await fetch('/api/lint', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ root: worktreePath, path: filePath }),
			});
			const data = await res.json();
			if (data.diagnostics) {
				diagnostics = data.diagnostics;
				const model = editor.getModel();
				if (model) {
					const markers = data.diagnostics.map((d: any) => ({
						startLineNumber: d.line,
						startColumn: d.column,
						endLineNumber: d.endLine,
						endColumn: d.endColumn,
						message: d.code ? `${d.message} (${d.code})` : d.message,
						severity:
							d.severity === 'error'
								? monaco.MarkerSeverity.Error
								: d.severity === 'warning'
									? monaco.MarkerSeverity.Warning
									: monaco.MarkerSeverity.Info,
						source: d.source,
					}));
					monaco.editor.setModelMarkers(model, 'lint', markers);
				}
			}
		} catch {
			// Linting is best-effort
		}
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
				<div class="flex items-center gap-1.5">
					{#if completionLoading}
						<LoaderCircleIcon class="h-3 w-3 animate-spin text-muted-foreground/60" />
					{/if}
					{#if errorCount > 0}
						<Badge variant="destructive" class="text-[10px] px-1.5 py-0">{errorCount} {errorCount === 1 ? 'error' : 'errors'}</Badge>
					{/if}
					{#if warningCount > 0}
						<Badge variant="outline" class="text-[10px] px-1.5 py-0 border-amber-500/50 text-amber-500">{warningCount} {warningCount === 1 ? 'warning' : 'warnings'}</Badge>
					{/if}
					<span class="text-muted-foreground/60">{language}</span>
				</div>
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
