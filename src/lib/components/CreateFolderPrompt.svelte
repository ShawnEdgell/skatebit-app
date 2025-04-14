<!-- src/lib/features/explorer/components/CreateFolderPrompt.svelte -->
<script lang="ts">
	import { normalizePath } from '$lib/ts/pathUtils';

	export let missingPath: string | undefined | null = '';
	export let promptType: 'skaterXlBase' | 'genericMod' = 'genericMod';
	export let onCreate: () => void;

	let message = '';
	let details = '';
	let showCreateButton = true;

	$: {
		const normalizedMissingPath = normalizePath(missingPath ?? ''); // Provide fallback

		if (promptType === 'skaterXlBase') {
			message = 'Skater XL Folder Not Found';
			details = `The main Skater XL folder (${normalizedMissingPath}) required for maps, gear, and mods could not be located in your Documents folder. Please ensure Skater XL is installed and has been run at least once. Creating it manually might not be sufficient.`;
			showCreateButton = false;
		} else {
			message = 'Folder Not Found';
			details = `The folder (${normalizedMissingPath}) doesn't seem to exist yet. Some mods require specific folders. You can create it now if needed.`;
			showCreateButton = true;
		}
	}
</script>

<!-- Template remains the same -->
<div class="h-full flex flex-col items-center justify-center text-center p-6 bg-base-200 rounded-box gap-4">
    <!-- ... SVG Icon ... -->
	<h3 class="text-xl font-semibold text-warning-content">{message}</h3>
	<p class="text-base-content text-opacity-80 max-w-md">{details}</p>
	{#if showCreateButton}
		<button class="btn btn-primary btn-sm mt-2" on:click={onCreate}> Create Folder Now </button>
	{/if}
</div>