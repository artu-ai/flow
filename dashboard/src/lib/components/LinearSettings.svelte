<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { linearApiKey } from '$lib/stores';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';

	let { open = $bindable(false) }: { open: boolean } = $props();

	let apiKeyInput = $state('');
	let validating = $state(false);
	let error = $state('');
	let connectedName = $state<string | null>(null);

	// Fetch connected user name when opening with an existing key
	$effect(() => {
		if (open && $linearApiKey && !connectedName) {
			fetchConnectedUser();
		}
		if (!open) {
			apiKeyInput = '';
			error = '';
		}
	});

	async function fetchConnectedUser() {
		try {
			const res = await fetch('/api/linear/validate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ apiKey: $linearApiKey }),
			});
			const data = await res.json();
			if (data.valid) {
				connectedName = data.name ?? 'Unknown';
			} else {
				// Key is no longer valid
				linearApiKey.set(null);
				connectedName = null;
			}
		} catch {
			// Silently fail — user can reconnect
		}
	}

	async function handleSave() {
		error = '';
		if (!apiKeyInput.trim()) {
			error = 'API key is required';
			return;
		}
		validating = true;
		try {
			const res = await fetch('/api/linear/validate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ apiKey: apiKeyInput.trim() }),
			});
			const data = await res.json();
			if (data.valid) {
				linearApiKey.set(apiKeyInput.trim());
				connectedName = data.name ?? 'Unknown';
				apiKeyInput = '';
			} else {
				error = 'Invalid API key';
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Validation failed';
		} finally {
			validating = false;
		}
	}

	function handleDisconnect() {
		linearApiKey.set(null);
		connectedName = null;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Linear Integration</Dialog.Title>
			<Dialog.Description>Connect your Linear account to create worktrees from assigned issues.</Dialog.Description>
		</Dialog.Header>

		{#if $linearApiKey}
			<div class="flex flex-col gap-4">
				<p class="text-sm text-muted-foreground">
					Connected as <span class="font-medium text-foreground">{connectedName ?? '...'}</span>
				</p>
				<Button variant="outline" onclick={handleDisconnect}>Disconnect</Button>
			</div>
		{:else}
			<form
				class="flex flex-col gap-4"
				onsubmit={(e) => { e.preventDefault(); handleSave(); }}
			>
				<div class="flex flex-col gap-2">
					<label for="linear-api-key" class="text-sm font-medium">API Key</label>
					<Input
						id="linear-api-key"
						type="password"
						placeholder="lin_api_..."
						bind:value={apiKeyInput}
						disabled={validating}
					/>
					{#if error}
						<p class="text-sm text-destructive">{error}</p>
					{/if}
				</div>
				<Button type="submit" disabled={validating}>
					{#if validating}
						<LoaderCircleIcon class="mr-2 h-4 w-4 animate-spin" />
						Validating...
					{:else}
						Save
					{/if}
				</Button>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>
