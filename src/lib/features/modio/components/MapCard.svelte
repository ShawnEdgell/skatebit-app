<!-- src/lib/features/modio/components/MapCard.svelte -->
<script lang="ts">
	import type { Mod } from '$lib/types/modio';
	import { formatFileSize, formatRelativeTime } from '$lib/utils/formatter';
	import { invoke } from '@tauri-apps/api/core';
	import { refreshLocalMaps } from '$lib/stores/localMapsStore';
	import { handleError, handleSuccess } from '$lib/ts/errorHandler';
	import { get } from 'svelte/store';
	import { mapsFolder } from '$lib/stores/mapsFolderStore';
	import { documentDir, normalize, join } from '@tauri-apps/api/path';
	import { normalizePath } from '$lib/ts/pathUtils';

	type ExtendedMod = Mod & { imageUrl?: string };
	export let mod: ExtendedMod;

	let isInstalling = false;

	async function handleDownload() {
	console.log('Install button clicked');
	isInstalling = true;
	try {
		const mapsRootAbsolutePath = get(mapsFolder);
		if (!mapsRootAbsolutePath || mapsRootAbsolutePath.startsWith('/error')) {
			throw new Error('Maps folder path is not set or invalid.');
		}

		const docDir = normalizePath(await documentDir()); // Returns string | null
		const normMapsRoot = normalizePath(mapsRootAbsolutePath); // Returns string | null

		let destination: string;
		// If folder is inside Documents, calculate a relative subfolder.
		if (normMapsRoot && docDir && normMapsRoot.startsWith(docDir)) {
			let relativeSubfolder = normMapsRoot.substring(docDir.length).replace(/^[\/\\]/, '');
			if (relativeSubfolder === '') relativeSubfolder = '.';
			destination = relativeSubfolder;
		} else if (normMapsRoot) {
			destination = normMapsRoot;
		} else {
			throw new Error(`Could not determine a valid destination folder.`);
		}

		if (!mod.modfile?.download?.binary_url) {
			throw new Error("Mod file download URL is missing.");
		}

		await invoke('download_and_install', {
			url: mod.modfile.download.binary_url,
			destinationSubfolder: destination, // Using the computed destination folder
		});

		console.log('Download and install completed successfully.');
		await refreshLocalMaps();
		handleSuccess('Map installed successfully', 'Installation');
	} catch (error) {
		handleError(error, 'Installation');
	} finally {
		isInstalling = false;
	}
}

</script>

<div
	role="listitem"
	class="relative rounded-lg card shadow-md overflow-hidden flex-shrink-0 group aspect-video bg-base-200 h-45"
>
	{#if mod.imageUrl}
		<img
			src={mod.imageUrl}
			alt={mod.name ?? ''}
			class="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
			loading="lazy"
			draggable="false"
		/>
	{:else if mod.logo?.thumb_320x180}
		<img
			src={mod.logo.thumb_320x180}
			alt={mod.name ?? ''}
			class="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
			loading="lazy"
			draggable="false"
		/>
	{:else}
		<div class="absolute inset-0 grid place-content-center bg-base-300 text-base-content/50 text-sm">
			No Image
		</div>
	{/if}

	{#if mod.modfile?.filesize}
		<span class="absolute top-1 right-1 bg-black/50 text-white text-xs rounded px-1.5 py-0.5">
			{formatFileSize(mod.modfile.filesize)}
		</span>
	{/if}

	<div
		class="absolute bottom-0 z-10 w-full p-2.5 bg-gradient-to-t from-black/70 to-transparent pointer-events-none"
	>
		<span
			class="font-semibold text-base md:text-lg text-white drop-shadow-md line-clamp-2 leading-tight"
		>
			{mod.name ?? 'Untitled Mod'}
		</span>
		{#if mod.submitted_by || mod.date_added}
			<div class="text-xs text-neutral-content/80 mt-1 flex items-center flex-wrap gap-x-1.5">
				{#if mod.submitted_by?.username}
					<span>{mod.submitted_by.username}</span>
				{/if}
				{#if mod.submitted_by && mod.date_added}
					<span class="opacity-60">|</span>
				{/if}
				{#if mod.date_added}
					<span title={new Date(mod.date_added * 1000).toLocaleString()}>
						{formatRelativeTime(mod.date_added)}
					</span>
				{/if}
			</div>
		{/if}
	</div>

	<div
		class="absolute inset-0 z-20 flex items-center justify-center gap-3 bg-neutral/70 opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none"
	>
		<a
			href={mod.profile_url}
			target="_blank"
			rel="noopener noreferrer"
			class="btn btn-secondary btn-sm pointer-events-auto"
			on:click|stopPropagation>View Details</a
		>
		{#if mod.modfile?.download?.binary_url}
			<button
				on:click|stopPropagation={handleDownload}
				disabled={isInstalling}
				class="btn btn-primary btn-sm pointer-events-auto"
			>
				{#if isInstalling}
					<span class="loading loading-spinner loading-sm"></span> Installing...
				{:else}
					Install
				{/if}
			</button>
		{:else}
			<span class="badge badge-sm badge-error pointer-events-auto opacity-80">No file</span>
		{/if}
	</div>
</div>