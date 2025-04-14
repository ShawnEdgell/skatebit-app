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
		absoluteBaseFolderPath,
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
	import { ListingStatus, baseFolder, type FsEntry } from '$lib/ts/fsOperations';
	import { toastStore } from '$lib/stores/toastStore';
	import { refreshLocalMaps } from '$lib/stores/localMapsStore';
	import { handleError } from '$lib/ts/errorHandler';

	let fileInput: HTMLInputElement;
	let isDraggingOverZone = false;
	let unlisten: (() => void) | null = null;
	let isBaseSkaterXlFolderMissing = false;
	let isGenericModFolderMissing = false;
	// Removed local variable, use $absoluteBaseFolderPath where needed reactively

	onMount(async () => {
		// Base path is handled reactively by the store now
		unlisten = await getCurrentWebview().onDragDropEvent(async (event) => {
			const payload = event.payload;
			switch (payload.type) {
				case 'over': isDraggingOverZone = true; break;
				case 'drop':
					if ('paths' in payload && payload.paths?.length > 0) {
						try {
							const currentAbsPath = get(currentPath);
							if(!currentAbsPath) { throw new Error("Current path is invalid for drop operation."); }
							await handleDroppedPaths(payload.paths, currentAbsPath);
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
		const currentBase = get(absoluteBaseFolderPath); // Use get() for script logic
		if (!currentBase || currentBase.startsWith('/error')) { handleError('Base path not initialized', 'Switch Tab'); return; }
		try {
			const newAbsolutePath = await normalize(await join(currentBase, subfolder));
			await setPath(newAbsolutePath);
		} catch (error) { handleError(error, 'Switching tab'); }
	}

	async function handleFileChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const files = target?.files;
        const currentAbsPath = get(currentPath);
        if (!currentAbsPath) { handleError("Cannot upload: Current path is invalid.", "Upload"); return; }
		await uploadFilesToCurrentPath(files, currentAbsPath, async () => {
			await refresh();
			if (target) target.value = '';
		});
	}

	async function onUpload() { fileInput?.click(); }

	async function onRename(name: string) {
		const currentEntries = get(entries);
		openModal({
			title: `Rename "${name}"`, placeholder: "Enter new name", initialValue: name, confirmOnly: false,
			onSave: async (newName) => {
				if (!newName || newName === name) return;
                const originalEntry = currentEntries.find(entry => entry.name === name);
                const existingEntryWithNewName = currentEntries.find(entry => entry.name === newName);
                if (existingEntryWithNewName) {
                    if (originalEntry && existingEntryWithNewName.isDirectory === originalEntry.isDirectory) {
                        openModal({
                            title: "Confirm Replace",
                            message: `An item named "${newName}" already exists. Replace it?`,
                            confirmText: "Replace", cancelText: "Cancel", confirmClass: "btn-warning", confirmOnly: false,
                            onSave: async () => {
                                try { await rename(name, newName); toastStore.addToast(`Renamed "${name}" to "${newName}"`, 'alert-info'); }
                                catch (error) { /* Handled */ }
                            }
                        });
                    } else {
                        const existingType = existingEntryWithNewName.isDirectory ? 'folder' : 'file';
                        toastStore.addToast(`Cannot rename: A ${existingType} named "${newName}" already exists.`, 'alert-error');
                    }
                } else {
                    try { await rename(name, newName); toastStore.addToast(`Renamed "${name}" to "${newName}"`, 'alert-info'); }
                    catch (error) { /* Handled */ }
                }
			}
		});
	}

	async function onDelete(name: string) {
		openModal({
			title: "Confirm Deletion", message: `Are you sure you want to permanently delete "${name}"? This cannot be undone.`,
			confirmText: 'Delete', cancelText: 'Cancel', confirmClass: 'btn-error', confirmOnly: false,
			onSave: async () => {
				try {
					const currentAbsPath = get(currentPath);
                    if (!currentAbsPath) { throw new Error("Current path is invalid for delete."); }
					await deleteEntry(name);
					toastStore.addToast(`Deleted "${name}"`, 'alert-warning');
					const mapsRootAbsPath = await join(await documentDir(), baseFolder, 'Maps');
					const absPathToDelete = await join(currentAbsPath, name);
                    const normToDelete = normalizePath(absPathToDelete);
                    const normMapsRoot = normalizePath(mapsRootAbsPath);
					if (normToDelete && normMapsRoot && normToDelete.startsWith(normMapsRoot)) { await refreshLocalMaps(); }
				} catch (error) { handleError(error, `Deleting ${name}`); }
			}
		});
	}

	async function onNewFolder() {
        const currentEntries = get(entries);
		openModal({
			title: 'Create New Folder', placeholder: 'Enter folder name', initialValue: '', confirmOnly: false,
			onSave: async (folderName) => {
				if (!folderName) return;
                const existingEntry = currentEntries.find(entry => entry.name === folderName);
                if (existingEntry && existingEntry.isDirectory) { toastStore.addToast(`Folder "${folderName}" already exists.`, 'alert-error'); return; }
                else if (existingEntry && !existingEntry.isDirectory) { toastStore.addToast(`A file named "${folderName}" already exists. Cannot create folder with the same name.`, 'alert-error'); return; }
				try { await newFolder(folderName); toastStore.addToast(`Folder "${folderName}" created`, 'alert-success'); }
				catch (error) { /* Handled */ }
			}
		});
	}

	async function onNewFile() {
        const currentEntries = get(entries);
		openModal({
			title: 'Create New File', placeholder: 'Enter file name', initialValue: '', confirmOnly: false,
			onSave: async (fileName) => {
				if (!fileName) return;
                const existingEntry = currentEntries.find(entry => entry.name === fileName);
                if (existingEntry && !existingEntry.isDirectory) { toastStore.addToast(`File "${fileName}" already exists.`, 'alert-error'); return; }
                else if (existingEntry && existingEntry.isDirectory) { toastStore.addToast(`A folder named "${fileName}" already exists. Cannot create file with the same name.`, 'alert-error'); return; }
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
		if (!path || path.startsWith('/error')) { handleError("Cannot create directory: Path is invalid.", "Create Directory"); return; }
		try {
			await createDirectory(path);
            const folderName = path.split('/').pop() || 'New Folder';
			toastStore.addToast(`Folder "${folderName}" created successfully.`, 'alert-success');
			await refresh();
		} catch (error) { console.error(`Error creating directory ${path} from layout handler:`, error); }
	}

	$: {
		const normCurrent = normalizePath(get(currentPath));
		const normBase = normalizePath($absoluteBaseFolderPath); // Use $ for reactive value
		isBaseSkaterXlFolderMissing = ($directoryStatus === ListingStatus.DoesNotExist && !!normBase && normCurrent === normBase);
		isGenericModFolderMissing = ($directoryStatus === ListingStatus.DoesNotExist && !isBaseSkaterXlFolderMissing);
	}
</script>

<DropOverlay show={isDraggingOverZone} />

<!-- Main flex container for the whole page -->
<div class="flex h-full w-full bg-base-300">

	<!-- Main Content Area (Takes Remaining Space) -->
	<div class="flex flex-col flex-1 w-full overflow-hidden px-4 pb-4 gap-4">

		<!-- Header Row -->
		<div class="flex justify-between items-center w-full flex-shrink-0 bg-base-100 p-2 rounded-box shadow-md">
			<div class="flex-grow overflow-hidden min-w-0 mr-4">
				<PathHeader
					currentPath={$currentPath}
					onGoBack={goUp}
					absoluteBasePath={$absoluteBaseFolderPath}
				/>
			</div>
			<div class="flex-shrink-0">
				<FileActions {onNewFolder} {onNewFile} {onUpload} onOpenExplorer={openCurrentPathInExplorer} />
			</div>
		</div>
		<div class="flex h-full mb-16 w-full overflow-hidden gap-4">
			<TabSwitcher
				{tabs}
				currentPath={$currentPath}
				baseFolder={$absoluteBaseFolderPath}
				onSwitchTab={handleSwitchTab}
			/>

			<!-- File List Area (Takes Remaining Vertical Space, Scrolls Internally) -->
			<div class="h-full w-full overflow-y-auto rounded-box bg-base-100 p-2 shadow relative min-h-0">
				{#if $directoryStatus === ListingStatus.DoesNotExist}
					<CreateFolderPrompt
						missingPath={$currentPath}
						promptType={isBaseSkaterXlFolderMissing ? 'skaterXlBase' : 'genericMod'}
						onCreate={handleCreateDirectory}
					/>
				{:else if $directoryStatus === ListingStatus.ExistsAndEmpty}
                	<div class="flex h-full items-center justify-center text-center p-4">
						<p class="text-base-content/60">This folder is empty.</p>
                	</div>
				{:else}
					{#if $isLoading && !$entries.length}
						<div class="absolute inset-0 flex items-center justify-center text-center p-4 z-10 bg-base-100/50 rounded-box">
							<span class="loading loading-spinner loading-lg"></span> 
						</div>
					{/if}
                	{#key $currentPath}
				    	<FileList
                        	entries={$entries}
                        	loading={$isLoading && $entries.length > 0} 
                        	onOpenDirectory={openDirectory}
                        	{onRename}
                        	{onDelete}
                    	/>
                	{/key}
				{/if}
			</div>
		</div>
	</div>
	<input type="file" multiple bind:this={fileInput} on:change={handleFileChange} class="hidden" />
</div>