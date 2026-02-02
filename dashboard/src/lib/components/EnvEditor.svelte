<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';

	interface Props {
		open: boolean;
		filePath: string;
		worktreePath: string;
	}

	let { open = $bindable(), filePath, worktreePath }: Props = $props();

	type Line =
		| { type: 'kv'; key: string; value: string; visible: boolean }
		| { type: 'raw'; text: string };

	let lines = $state<Line[]>([]);
	let saving = $state(false);
	let loading = $state(false);
	let error = $state('');

	function parseLine(raw: string): Line {
		const trimmed = raw.trimStart();
		if (trimmed === '' || trimmed.startsWith('#')) {
			return { type: 'raw', text: raw };
		}
		const eqIdx = raw.indexOf('=');
		if (eqIdx === -1) {
			return { type: 'raw', text: raw };
		}
		return { type: 'kv', key: raw.substring(0, eqIdx), value: raw.substring(eqIdx + 1), visible: false };
	}

	function serialize(): string {
		return lines.map((l) => {
			if (l.type === 'raw') return l.text;
			return `${l.key}=${l.value}`;
		}).join('\n') + '\n';
	}

	async function loadFile() {
		loading = true;
		error = '';
		try {
			const params = new URLSearchParams({ root: worktreePath, path: filePath });
			const res = await fetch(`/api/files?${params}`);
			const data = await res.json();
			if (data.error) {
				error = data.error;
				lines = [];
				return;
			}
			const content = (data.content as string) ?? '';
			// Split but remove trailing empty line from trailing newline
			const rawLines = content.split('\n');
			if (rawLines.length > 0 && rawLines[rawLines.length - 1] === '') {
				rawLines.pop();
			}
			lines = rawLines.map(parseLine);
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			loading = false;
		}
	}

	async function handleSave() {
		saving = true;
		error = '';
		try {
			const params = new URLSearchParams({ root: worktreePath, path: filePath });
			const res = await fetch(`/api/files?${params}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ content: serialize() }),
			});
			const data = await res.json();
			if (!res.ok) {
				error = data.error || 'Failed to save';
				return;
			}
			open = false;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			saving = false;
		}
	}

	function addVariable() {
		lines = [...lines, { type: 'kv', key: '', value: '', visible: true }];
	}

	function removeLine(index: number) {
		lines = lines.filter((_, i) => i !== index);
	}

	function toggleVisibility(index: number) {
		const line = lines[index];
		if (line.type === 'kv') {
			lines[index] = { ...line, visible: !line.visible };
		}
	}

	$effect(() => {
		if (open && filePath) {
			loadFile();
		}
	});

	let fileName = $derived(filePath.split('/').pop() ?? filePath);
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-xl max-h-[80vh] flex flex-col">
		<Dialog.Header>
			<Dialog.Title class="font-mono">{fileName}</Dialog.Title>
			<Dialog.Description>Edit environment variables. Values are masked by default.</Dialog.Description>
		</Dialog.Header>

		{#if loading}
			<div class="flex items-center justify-center py-8">
				<LoaderCircleIcon class="h-5 w-5 animate-spin text-muted-foreground" />
			</div>
		{:else}
			<div class="flex-1 overflow-y-auto space-y-1.5 py-2">
				{#each lines as line, i}
					{#if line.type === 'kv'}
						<div class="flex items-center gap-1.5">
							<Input
								class="font-mono text-xs h-8 flex-1"
								placeholder="KEY"
								value={line.key}
								oninput={(e) => {
									const target = e.target as HTMLInputElement;
									lines[i] = { ...line, key: target.value };
								}}
							/>
							<span class="text-xs text-muted-foreground shrink-0">=</span>
							<Input
								class="font-mono text-xs h-8 flex-[2]"
								placeholder="value"
								type={line.visible ? 'text' : 'password'}
								value={line.value}
								oninput={(e) => {
									const target = e.target as HTMLInputElement;
									lines[i] = { ...line, value: target.value };
								}}
							/>
							<Button
								variant="ghost"
								size="icon"
								class="h-8 w-8 shrink-0"
								onclick={() => toggleVisibility(i)}
							>
								{#if line.visible}
									<EyeIcon class="h-3.5 w-3.5" />
								{:else}
									<EyeOffIcon class="h-3.5 w-3.5" />
								{/if}
							</Button>
							<Button
								variant="ghost"
								size="icon"
								class="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
								onclick={() => removeLine(i)}
							>
								<TrashIcon class="h-3.5 w-3.5" />
							</Button>
						</div>
					{:else}
						<div class="flex items-center px-1">
							<span class="text-xs text-muted-foreground font-mono truncate">{line.text || '\u00A0'}</span>
						</div>
					{/if}
				{/each}
			</div>

			<Button variant="outline" size="sm" class="w-full gap-1.5" onclick={addVariable}>
				<PlusIcon class="h-3.5 w-3.5" />
				Add variable
			</Button>
		{/if}

		{#if error}
			<p class="text-sm text-destructive">{error}</p>
		{/if}

		<Dialog.Footer>
			<Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
			<Button onclick={handleSave} disabled={saving || loading}>
				{#if saving}
					<LoaderCircleIcon class="mr-2 h-4 w-4 animate-spin" />
					Saving...
				{:else}
					Save
				{/if}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
