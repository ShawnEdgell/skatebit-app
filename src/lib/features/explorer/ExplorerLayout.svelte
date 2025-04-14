<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import { getCurrentWebview } from '@tauri-apps/api/webview';
	import { documentDir, normalize, join } from '@tauri-apps/api/path';
	import { revealItemInDir } from '@tauri-apps/plugin-opener';
	import { uploadFilesToCurrentPath } from '$lib/utils/useFileUpload';
	import { baseFolder as relativeBaseFolderConst, handleDroppedPaths } from '$lib';
	import {
		currentPath,
		entries,
		isLoading,
		directoryStatus,
		refresh,
		setPath,
		goUp,
		createDirectory,
		rename,
		deleteEntry,
		newFolder,
		newFile,
		openDirectory,
		getAbsoluteBaseFolderPath,
	} from '$lib/stores/explorerStore';
	import CreateFolderPrompt from '$lib/components/CreateFolderPrompt.svelte';
	import TabSwitcher from '$lib/features/explorer/components/TabSwitcher.svelte';
	import FileList from '$lib/features/explorer/components/FileList.svelte';
	import PathHeader from '$lib/features/explorer/components/PathHeader.svelte';
	import FileActions from '$lib/features/explorer/components/FileActions.svelte';
	import DropOverlay from '$lib/components/DropOverlay.svelte';
	import { explorerTabs as tabs } from './tabs';
	import { normalizePath } from '$lib/ts/pathUtils';
	import { openModal } from '$lib/stores/modalStore';
	import { ListingStatus, baseFolder } from '$lib/ts/fsOperations';
	import { toastStore } from '$lib/stores/toastStore';
	import { refreshLocalMaps } from '$lib/stores/localMapsStore';
	import { handleError } from '$lib/ts/errorHandler';

	let fileInput: HTMLInputElement;
	let isDraggingOverZone = false;
	let unlisten: (() => void) | null = null;
	let isBaseSkaterXlFolderMissing = false;
	let isGenericModFolderMissing = false;
	let currentAbsoluteBaseFolderPath = '';

	onMount(async () => {
		currentAbsoluteBaseFolderPath = getAbsoluteBaseFolderPath();
		unlisten = await getCurrentWebview().onDragDropEvent(async (event) => {
			const payload = event.payload;
			switch (payload.type) {
				case 'over': isDraggingOverZone = true; break;
				case 'drop':
					if ('paths' in payload && payload.paths?.length > 0) {
						try {
                            const currentAbsPath = get(currentPath);
                            if(!currentAbsPath) { // Check if path is valid
                                throw new Error("Current path is invalid for drop operation.");
                            }
							await handleDroppedPaths(payload.paths, currentAbsPath); // Pass guaranteed string
							await refresh();
						} catch (error) { handleError(error, 'Handling dropped files'); }
					}
					isDraggingOverZone = false; break;
				case 'leave': isDraggingOverZone = false; break;
			}
		});
	});

	onDestroy(() => { unlisten?.(); });

	async function handleSwitchTab(subfolder: string) {
		if (!currentAbsoluteBaseFolderPath) { handleError('Base path not initialized', 'Switch Tab'); return; }
		try {
			const newAbsolutePath = await normalize(await join(currentAbsoluteBaseFolderPath, subfolder));
			await setPath(newAbsolutePath);
		} catch (error) { handleError(error, 'Switching tab'); }
	}

	async function handleFileChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const files = target?.files;
        const currentAbsPath = get(currentPath);
        if (!currentAbsPath) { handleError("Cannot upload: Current path is invalid.", "Upload"); return; }
		await uploadFilesToCurrentPath(files, currentAbsPath, async () => { // Pass guaranteed string
			await refresh();
			if (target) target.value = '';
		});
	}

	async function onUpload() { fileInput?.click(); }

	async function onRename(name: string) {
		openModal({
			title: `Rename "${name}"`, placeholder: 'Enter new name', initialValue: name, confirmOnly: false,
			onSave: async (newName) => {
				if (!newName || newName === name) return;
				try { await rename(name, newName); toastStore.addToast(`Renamed "${name}" to "${newName}"`, 'alert-info'); }
				catch (error) { /* Handled */ }
			}
		});
	}

	async function onDelete(name: string) {
		openModal({
			title: "Confirm Deletion",
			message: `Are you sure you want to permanently delete "${name}"? This cannot be undone.`,
			confirmText: 'Delete', cancelText: 'Cancel', confirmClass: 'btn-error', confirmOnly: false,
			onSave: async () => {
				try {
					const currentAbsPath = get(currentPath);
                    if (!currentAbsPath) { throw new Error("Current path is invalid for delete."); } // Check path
					await deleteEntry(name);
					toastStore.addToast(`Deleted "${name}"`, 'alert-warning');
					const mapsRootAbsPath = await join(await documentDir(), baseFolder, 'Maps');
					const absPathToDelete = await join(currentAbsPath, name); // currentAbsPath is now string
                    const normToDelete = normalizePath(absPathToDelete);
                    const normMapsRoot = normalizePath(mapsRootAbsPath);
					if (normToDelete && normMapsRoot && normToDelete.startsWith(normMapsRoot)) {
						await refreshLocalMaps();
					}
				} catch (error) {
                    console.error(`Deletion failed for ${name} in component handler:`, error);
                    handleError(error, `Deleting ${name}`);
                 }
			}
		});
	}

	async function onNewFolder() {
		openModal({
			title: 'Create New Folder', placeholder: 'Enter folder name', initialValue: '', confirmOnly: false,
			onSave: async (folderName) => {
				if (!folderName) return;
				try { await newFolder(folderName); toastStore.addToast(`Folder "${folderName}" created`, 'alert-success'); }
				catch (error) { /* Handled */ }
			}
		});
	}

	async function onNewFile() {
		openModal({
			title: 'Create New File', placeholder: 'Enter file name', initialValue: '', confirmOnly: false,
			onSave: async (fileName) => {
				if (!fileName) return;
				try { await newFile(fileName); toastStore.addToast(`File "${fileName}" created`, 'alert-success'); }
				catch (error) { /* Handled */ }
			}
		});
	}

	async function openCurrentPathInExplorer() {
		const path = get(currentPath);
		if (!path || path.startsWith('/error')) { handleError('Current path is not available or invalid.', 'Open Explorer'); return; }
		try { await revealItemInDir(path); }
		catch (error) { handleError(error, `Failed to reveal path: ${path}`); }
	}

	async function handleCreateDirectory() {
		const path = get(currentPath);
		if (!path || path.startsWith('/error')) return;
		await createDirectory(path);
	}

	$: {
		const normCurrent = normalizePath(get(currentPath));
		const normBase = normalizePath(currentAbsoluteBaseFolderPath);
		isBaseSkaterXlFolderMissing = ($directoryStatus === ListingStatus.DoesNotExist && !!normBase && normCurrent === normBase);
		isGenericModFolderMissing = ($directoryStatus === ListingStatus.DoesNotExist && !isBaseSkaterXlFolderMissing);
	}
</script>

<DropOverlay show={isDraggingOverZone} />

<div class="flex h-full">
	<TabSwitcher
		{tabs}
		currentPath={$currentPath}
		baseFolder={currentAbsoluteBaseFolderPath}
		onSwitchTab={handleSwitchTab}
	/>
	<div class="flex flex-col flex-1 w-full overflow-hidden p-4 space-y-4">
		<div class="flex justify-between items-center w-full flex-shrink-0">
			<div class="flex-grow overflow-hidden min-w-0 mr-4">
				<PathHeader
					currentPath={$currentPath}
					onGoBack={goUp}
					absoluteBasePath={currentAbsoluteBaseFolderPath}
				/>
			</div>
			<div class="flex-shrink-0">
				<FileActions {onNewFolder} {onNewFile} {onUpload} onOpenExplorer={openCurrentPathInExplorer} />
			</div>
		</div>
		<div class="flex-1 overflow-y-auto rounded-box">
			{#if $directoryStatus === ListingStatus.DoesNotExist}
				<CreateFolderPrompt
					missingPath={$currentPath}
					promptType={isBaseSkaterXlFolderMissing ? 'skaterXlBase' : 'genericMod'}
					onCreate={handleCreateDirectory}
				/>
			{:else if $directoryStatus === ListingStatus.ExistsAndEmpty}
				<div class="h-full flex items-center justify-center text-center p-4">
					<p class="text-base-content text-opacity-60">This folder is empty.</p>
				</div>
			{:else}
				<FileList
					entries={$entries}
					loading={$isLoading}
					onOpenDirectory={openDirectory}
					{onRename}
					{onDelete}
				/>
			{/if}
		</div>
		<input type="file" multiple bind:this={fileInput} on:change={handleFileChange} class="hidden" />
	</div>
</div>