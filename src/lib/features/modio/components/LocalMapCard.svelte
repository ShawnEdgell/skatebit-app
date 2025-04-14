<!-- src/lib/components/LocalMapCard.svelte -->
<script lang="ts">
	import type { FsEntry } from '$lib/ts/fsOperations';
	import GenericCard from './GenericCard.svelte';
	import { readFile, exists } from '@tauri-apps/plugin-fs';
	import { revealItemInDir } from '@tauri-apps/plugin-opener';
	import { createEventDispatcher, onMount, tick } from 'svelte';
	import { formatFileSize } from '$lib/utils/formatter';
	import { normalizePath } from '$lib/ts/pathUtils';

	export let localMap: FsEntry;
	const dispatch = createEventDispatcher();

	let blobUrl = '';
	let isLoadingUrl = false;
	let observer: IntersectionObserver;
	let cardElement: HTMLElement;
	let isVisible = false;
	let processedAbsolutePath: string | undefined | null = null;
	$: canPerformActions = !!localMap?.path;

	$: if (isVisible && localMap?.thumbnailPath && localMap.thumbnailPath !== processedAbsolutePath && !isLoadingUrl) {
		tick().then(() => {
			if (isVisible && localMap?.thumbnailPath && localMap.thumbnailPath !== processedAbsolutePath && !isLoadingUrl) {
				loadImageData(localMap.thumbnailPath, localMap.thumbnailMimeType ?? undefined);
			}
		});
	}

	$: if (localMap?.name && blobUrl && localMap?.thumbnailPath !== processedAbsolutePath) {
		if (blobUrl && blobUrl.startsWith('blob:')) {
			URL.revokeObjectURL(blobUrl);
		}
		blobUrl = '';
		processedAbsolutePath = null;
		isLoadingUrl = false;
	}

	async function loadImageData(absolutePath: string | undefined, mimeType: string | undefined) {
		if (!localMap || !absolutePath || !mimeType) return;
		if (localMap.thumbnailPath !== absolutePath || isLoadingUrl) return;

		isLoadingUrl = true;
		processedAbsolutePath = absolutePath;

		if (blobUrl && blobUrl.startsWith('blob:')) {
			URL.revokeObjectURL(blobUrl);
			blobUrl = '';
		}

		const MAX_RETRIES = 3;
		const INITIAL_DELAY = 200;
		let success = false;

		for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
			try {
				await tick();
				await new Promise((res) => setTimeout(res, 50));

				const fileExists = await exists(absolutePath); // absolutePath is already string | undefined, check handles undefined

				if (fileExists) {
					const binaryData = await readFile(absolutePath); // readFile expects string
					if (cardElement && localMap?.thumbnailPath === absolutePath) {
						const blob = new Blob([binaryData], { type: mimeType });
						blobUrl = URL.createObjectURL(blob);
						success = true;
						break;
					} else {
						processedAbsolutePath = null;
						break;
					}
				} else {
					console.warn(`[${localMap.name}] File NOT found at absolute path: ${absolutePath}`);
					break;
				}
			} catch (err: any) {
				console.error(`[${localMap.name}] Attempt ${attempt + 1}: Error loading image for ${absolutePath}`, err);
				if (err?.message?.includes('os error 2') || err?.message?.includes('failed to read file') || err?.message?.includes('path is a directory')) {
					break;
				}
			}

			if (!success && attempt < MAX_RETRIES - 1) {
				const delay = INITIAL_DELAY * (attempt + 1);
				await new Promise((res) => setTimeout(res, delay));
			}
		}

		isLoadingUrl = false;

		if (!success) {
			processedAbsolutePath = null;
			if (cardElement && localMap?.thumbnailPath === absolutePath) {
				console.error(`[${localMap.name}] Failed to load image ${absolutePath} after ${MAX_RETRIES} attempts.`);
			}
		}
	}

	onMount(() => {
		observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					isVisible = entry.isIntersecting;
				});
			},
			{ threshold: 0.1 }
		);

		if (cardElement) observer.observe(cardElement);

		return () => {
			observer?.disconnect();
			if (blobUrl && blobUrl.startsWith('blob:')) {
				URL.revokeObjectURL(blobUrl);
				blobUrl = '';
			}
		};
	});

	async function openInExplorer() { // Removed unused event param 'e'
		if (!localMap?.path) return;
		try {
            // --- FIX: Check for null before passing to revealItemInDir ---
            const normalized = normalizePath(localMap.path);
            if (normalized) {
                await revealItemInDir(normalized);
            } else {
                 console.error("Cannot open in explorer: Normalized path is null.");
            }
            // --- END FIX ---
		} catch (error) {
			console.error('Error using opener plugin:', error);
		}
	}

	function triggerDelete(e: MouseEvent) {
		e.stopPropagation();
		if (!localMap?.path) return;
		dispatch('requestDelete', { path: localMap.path, name: localMap.name });
	}
</script>

<div bind:this={cardElement} class="relative flex-shrink-0 w-80 aspect-video">
	<GenericCard
		imageUrl={blobUrl}
		fallbackIcon={localMap?.isDirectory ? '📁' : '📄'}
		badgeText={localMap?.size != null ? formatFileSize(localMap.size) : ''}
        title={localMap?.name ?? 'Unnamed Map'} 
	>
		<span slot="overlay">
			<button
				class="btn btn-secondary btn-sm pointer-events-auto"
				on:click|preventDefault|stopPropagation={openInExplorer}
				disabled={!canPerformActions}>Open</button
			>
			<button
				class="btn btn-error btn-sm pointer-events-auto"
				on:click|preventDefault|stopPropagation={triggerDelete}
				disabled={!canPerformActions}>Delete</button
			>
		</span>
	</GenericCard>
	{#if isLoadingUrl && !blobUrl}
		<div class="absolute inset-0 grid place-content-center bg-base-300/50 z-30 rounded-lg">
			<span class="loading loading-spinner loading-sm"></span>
		</div>
	{/if}
</div>