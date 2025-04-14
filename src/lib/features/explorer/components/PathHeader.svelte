<!-- src/lib/components/PathHeader.svelte -->
<script lang="ts">
	import { normalizePath } from '$lib/ts/pathUtils';
	import { get, writable } from 'svelte/store';
	import { documentDir, normalize } from '@tauri-apps/api/path';
	import { onMount } from 'svelte';

	export let currentPath: string | undefined | null = '';
	export let onGoBack: () => void;
	export let absoluteBasePath: string = '';

	const documentDirPath = writable<string | null>(null); // Allow null initially

	onMount(async () => {
		try {
			// normalizePath can return null if normalize/documentDir fails
			const docDir = normalizePath(await normalize(await documentDir()));
			documentDirPath.set(docDir); // Set string | null
		} catch (e) {
			console.error('PathHeader: Failed to get docDir on mount', e);
			documentDirPath.set('/error/docdir'); // Set error string
		}
	});

	let displayPathSegments: string[] = [];
	$: {
		const normCurrent = normalizePath(currentPath); // Returns string | null
		const normDocDir = $documentDirPath ? normalizePath($documentDirPath) : null; // Also string | null

		if (normCurrent && normDocDir && normCurrent.startsWith(normDocDir)) {
			let relativeToDocs = normCurrent.substring(normDocDir.length).replace(/^[\/\\]/, '');
			const docDirName = normDocDir.split(/[\\/]/).pop() || 'Documents';
			displayPathSegments = relativeToDocs ? [docDirName, ...relativeToDocs.split('/')] : [docDirName];
		} else if (normCurrent) {
			const parts = normCurrent.split(/[\\/]/);
			displayPathSegments = parts[0].endsWith(':')
				? parts.slice(1).filter((s) => s !== '')
				: parts.filter((s) => s !== '');
		} else {
			displayPathSegments = ['Loading...'];
		}
	}

	$: {
		const normCurrent = normalizePath(currentPath); // string | null
		const normBase = normalizePath(absoluteBasePath); // string | null
		// Ensure both are non-null strings before comparing
		canGoBack = !!normCurrent && !!normBase && normCurrent !== normBase;
	}
	let canGoBack = false; // Separate reactive declaration
</script>

<div class="flex items-center space-x-2 text-sm" title={currentPath ?? ''}>
	<button
		class="btn btn-ghost btn-xs flex-shrink-0 px-2 disabled:opacity-50"
		on:click={onGoBack}
		disabled={!canGoBack}
		title="Go up one level"
		aria-label="Go up one level"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			stroke-width="1.5"
			stroke="currentColor"
			class="w-4 h-4"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M9 9l6-6m0 0l6 6m-6-6v12a6 6 0 01-12 0v-3"
			/>
		</svg>
	</button>

	<div class="flex items-center overflow-hidden text-ellipsis whitespace-nowrap" aria-label="Breadcrumb">
		{#each displayPathSegments as crumb, index (crumb + index)}
			{#if index > 0}
				<span class="mx-1 text-base-content/50 flex-shrink-0">/</span>
			{/if}
			<!-- Use text binding for safety unless HTML is strictly needed -->
			<span class:font-semibold={index === displayPathSegments.length - 1} class="text-base-content"
				>{crumb}</span
			>
		{/each}
	</div>
</div>