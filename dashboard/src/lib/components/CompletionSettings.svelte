<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Tabs from '$lib/components/ui/tabs';
	import * as Popover from '$lib/components/ui/popover';
	import * as Command from '$lib/components/ui/command';
	import * as ScrollArea from '$lib/components/ui/scroll-area';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { completionConfig } from '$lib/stores';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import CheckIcon from '@lucide/svelte/icons/check';

	let { open = $bindable(false) }: { open: boolean } = $props();

	let activeTab = $state<'ollama' | 'claude'>('ollama');

	// Ollama state
	let ollamaUrl = $state('http://localhost:11434');
	let ollamaModels = $state<string[]>([]);
	let ollamaSelectedModel = $state('');
	let ollamaValidating = $state(false);
	let ollamaError = $state('');
	let ollamaConnected = $state(false);
	let ollamaComboOpen = $state(false);
	let ollamaSearch = $state('');

	// Claude state
	let claudeApiKey = $state('');
	let claudeModel = $state('claude-3-5-haiku-20241022');
	let claudeModels = $state<string[]>([]);
	let claudeValidating = $state(false);
	let claudeError = $state('');
	let claudeConnected = $state(false);
	let claudeComboOpen = $state(false);
	let claudeSearch = $state('');

	let filteredOllamaModels = $derived(
		ollamaSearch
			? ollamaModels.filter((m) => m.toLowerCase().includes(ollamaSearch.toLowerCase()))
			: ollamaModels
	);

	let filteredClaudeModels = $derived(
		claudeSearch
			? claudeModels.filter((m) => m.toLowerCase().includes(claudeSearch.toLowerCase()))
			: claudeModels
	);

	$effect(() => {
		if (open) {
			const cfg = $completionConfig;
			ollamaUrl = cfg.ollama.url;
			ollamaSelectedModel = cfg.ollama.model;
			claudeModel = cfg.claude.model;
			claudeApiKey = '';

			if (cfg.activeProvider === 'ollama' && cfg.ollama.model) {
				ollamaConnected = true;
				activeTab = 'ollama';
				fetchOllamaModels(cfg.ollama.url);
			} else if (cfg.activeProvider === 'claude' && cfg.claude.apiKey) {
				claudeConnected = true;
				activeTab = 'claude';
			} else {
				ollamaConnected = false;
				claudeConnected = false;
			}
		}
		if (!open) {
			ollamaError = '';
			claudeError = '';
			ollamaSearch = '';
			claudeSearch = '';
		}
	});

	async function fetchOllamaModels(url: string) {
		try {
			const res = await fetch('/api/completions/validate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ provider: 'ollama', config: { url } }),
			});
			const data = await res.json();
			if (data.valid && data.models) {
				ollamaModels = data.models;
			}
		} catch {
			// Silent
		}
	}

	async function handleOllamaValidate() {
		ollamaError = '';
		if (!ollamaUrl.trim()) {
			ollamaError = 'URL is required';
			return;
		}
		ollamaValidating = true;
		try {
			const res = await fetch('/api/completions/validate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ provider: 'ollama', config: { url: ollamaUrl.trim() } }),
			});
			const data = await res.json();
			if (data.valid) {
				ollamaModels = data.models ?? [];
				if (ollamaModels.length > 0 && !ollamaSelectedModel) {
					ollamaSelectedModel = ollamaModels[0];
				}
			} else {
				ollamaError = data.error ?? 'Connection failed';
			}
		} catch (e) {
			ollamaError = e instanceof Error ? e.message : 'Connection failed';
		} finally {
			ollamaValidating = false;
		}
	}

	function handleOllamaSave() {
		if (!ollamaSelectedModel) {
			ollamaError = 'Select a model';
			return;
		}
		completionConfig.update((cfg) => ({
			...cfg,
			activeProvider: 'ollama',
			ollama: { url: ollamaUrl.trim(), model: ollamaSelectedModel },
		}));
		ollamaConnected = true;
	}

	async function handleClaudeValidate() {
		claudeError = '';
		if (!claudeApiKey.trim()) {
			claudeError = 'API key is required';
			return;
		}
		claudeValidating = true;
		try {
			const res = await fetch('/api/completions/validate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ provider: 'claude', config: { apiKey: claudeApiKey.trim() } }),
			});
			const data = await res.json();
			if (data.valid) {
				claudeModels = data.models ?? [];
				// Don't auto-save yet — let user pick model from combobox first
			} else {
				claudeError = data.error ?? 'Invalid API key';
			}
		} catch (e) {
			claudeError = e instanceof Error ? e.message : 'Validation failed';
		} finally {
			claudeValidating = false;
		}
	}

	function handleClaudeSave() {
		if (!claudeModel) {
			claudeError = 'Select a model';
			return;
		}
		completionConfig.update((cfg) => ({
			...cfg,
			activeProvider: 'claude',
			claude: { apiKey: claudeApiKey.trim() || cfg.claude.apiKey, model: claudeModel },
		}));
		claudeConnected = true;
		claudeApiKey = '';
	}

	function handleDisconnect() {
		completionConfig.update((cfg) => ({
			...cfg,
			activeProvider: null,
		}));
		ollamaConnected = false;
		claudeConnected = false;
		ollamaModels = [];
		claudeModels = [];
	}

	let isConnected = $derived($completionConfig.activeProvider !== null);
	let connectedInfo = $derived.by(() => {
		const cfg = $completionConfig;
		if (cfg.activeProvider === 'ollama') return `Ollama · ${cfg.ollama.model}`;
		if (cfg.activeProvider === 'claude') return `Claude · ${cfg.claude.model}`;
		return '';
	});
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Code Completion</Dialog.Title>
			<Dialog.Description>Configure AI-powered inline code completions.</Dialog.Description>
		</Dialog.Header>

		{#if isConnected}
			<div class="flex flex-col gap-4">
				<p class="text-sm text-muted-foreground">
					Connected: <span class="font-medium text-foreground">{connectedInfo}</span>
				</p>
				<Button variant="outline" onclick={handleDisconnect}>Disconnect</Button>
			</div>
		{:else}
			<Tabs.Root value={activeTab} onValueChange={(v) => activeTab = v as 'ollama' | 'claude'}>
				<Tabs.List class="w-full">
					<Tabs.Trigger value="ollama" class="flex-1">Ollama</Tabs.Trigger>
					<Tabs.Trigger value="claude" class="flex-1">Claude</Tabs.Trigger>
				</Tabs.List>

				<Tabs.Content value="ollama">
					<form
						class="flex flex-col gap-3 pt-2"
						onsubmit={(e) => { e.preventDefault(); ollamaModels.length > 0 ? handleOllamaSave() : handleOllamaValidate(); }}
					>
						<div class="flex flex-col gap-1.5">
							<label for="ollama-url" class="text-sm font-medium">Server URL</label>
							<div class="flex gap-2">
								<Input
									id="ollama-url"
									type="text"
									placeholder="http://localhost:11434"
									bind:value={ollamaUrl}
									disabled={ollamaValidating}
								/>
								<Button type="button" variant="outline" size="sm" onclick={handleOllamaValidate} disabled={ollamaValidating}>
									{#if ollamaValidating}
										<LoaderCircleIcon class="h-4 w-4 animate-spin" />
									{:else}
										Connect
									{/if}
								</Button>
							</div>
						</div>
						{#if ollamaModels.length > 0}
							<div class="flex flex-col gap-1.5">
								<span class="text-sm font-medium">Model</span>
								<Popover.Root bind:open={ollamaComboOpen}>
									<Popover.Trigger
										class="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs hover:bg-accent hover:text-accent-foreground"
									>
										<span class="truncate">{ollamaSelectedModel || 'Select model...'}</span>
										<ChevronsUpDownIcon class="ml-2 h-4 w-4 shrink-0 opacity-50" />
									</Popover.Trigger>
									<Popover.Content class="w-(--bits-popover-anchor-width) p-0">
										<Command.Root shouldFilter={false}>
											<Command.Input placeholder="Search models..." bind:value={ollamaSearch} />
											<ScrollArea.Root class="max-h-[200px]">
												<Command.List class="max-h-none overflow-visible">
													<Command.Empty>No models found.</Command.Empty>
													{#each filteredOllamaModels as model}
														<Command.Item
															value={model}
															onSelect={() => { ollamaSelectedModel = model; ollamaComboOpen = false; }}
														>
															<CheckIcon class="mr-2 h-4 w-4 {ollamaSelectedModel === model ? 'opacity-100' : 'opacity-0'}" />
															{model}
														</Command.Item>
													{/each}
												</Command.List>
											</ScrollArea.Root>
										</Command.Root>
									</Popover.Content>
								</Popover.Root>
							</div>
							<Button type="submit">Enable</Button>
						{/if}
						{#if ollamaError}
							<p class="text-sm text-destructive">{ollamaError}</p>
						{/if}
					</form>
				</Tabs.Content>

				<Tabs.Content value="claude">
					<form
						class="flex flex-col gap-3 pt-2"
						onsubmit={(e) => { e.preventDefault(); claudeModels.length > 0 ? handleClaudeSave() : handleClaudeValidate(); }}
					>
						<div class="flex flex-col gap-1.5">
							<label for="claude-api-key" class="text-sm font-medium">API Key</label>
							<div class="flex gap-2">
								<Input
									id="claude-api-key"
									type="password"
									placeholder="sk-ant-..."
									bind:value={claudeApiKey}
									disabled={claudeValidating}
								/>
								<Button type="button" variant="outline" size="sm" onclick={handleClaudeValidate} disabled={claudeValidating}>
									{#if claudeValidating}
										<LoaderCircleIcon class="h-4 w-4 animate-spin" />
									{:else}
										Connect
									{/if}
								</Button>
							</div>
						</div>
						{#if claudeModels.length > 0}
							<div class="flex flex-col gap-1.5">
								<span class="text-sm font-medium">Model</span>
								<Popover.Root bind:open={claudeComboOpen}>
									<Popover.Trigger
										class="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs hover:bg-accent hover:text-accent-foreground"
									>
										<span class="truncate">{claudeModel || 'Select model...'}</span>
										<ChevronsUpDownIcon class="ml-2 h-4 w-4 shrink-0 opacity-50" />
									</Popover.Trigger>
									<Popover.Content class="w-(--bits-popover-anchor-width) p-0">
										<Command.Root shouldFilter={false}>
											<Command.Input placeholder="Search models..." bind:value={claudeSearch} />
											<ScrollArea.Root class="max-h-[200px]">
												<Command.List class="max-h-none overflow-visible">
													<Command.Empty>No models found.</Command.Empty>
													{#each filteredClaudeModels as model}
														<Command.Item
															value={model}
															onSelect={() => { claudeModel = model; claudeComboOpen = false; }}
														>
															<CheckIcon class="mr-2 h-4 w-4 {claudeModel === model ? 'opacity-100' : 'opacity-0'}" />
															{model}
														</Command.Item>
													{/each}
												</Command.List>
											</ScrollArea.Root>
										</Command.Root>
									</Popover.Content>
								</Popover.Root>
							</div>
							<Button type="submit">Enable</Button>
						{/if}
						{#if claudeError}
							<p class="text-sm text-destructive">{claudeError}</p>
						{/if}
					</form>
				</Tabs.Content>
			</Tabs.Root>
		{/if}
	</Dialog.Content>
</Dialog.Root>
