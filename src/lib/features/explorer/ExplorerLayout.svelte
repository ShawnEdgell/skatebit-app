<!-- src/lib/features/explorer/ExplorerLayout.svelte -->
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
	import { handleError, handleSuccess } from '$lib/ts/errorHandler';
    import { invoke } from '@tauri-apps/api/core';

	let fileInput: HTMLInputElement;
	let isDraggingOverZone = false;
	let unlisten: (() => void) | null = null;
	let isBaseSkaterXlFolderMissing = false;
	let isGenericModFolderMissing = false;

	onMount(async () => {
		unlisten = await getCurrentWebview().onDragDropEvent(async (event) => {
			const payload = event.payload;
			switch (payload.type) {
				case 'over': isDraggingOverZone = true; break;
				case 'drop':
					if ('paths' in payload && payload.paths?.length > 0) {
						try {
							const currentAbsPath = get(currentPath);
							if(!currentAbsPath || currentAbsPath.startsWith('/error')) { throw new Error("Current path is invalid for drop operation."); }
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
		const currentBase = get(absoluteBaseFolderPath);
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
        if (!currentAbsPath || currentAbsPath.startsWith('/error')) { handleError("Cannot upload: Current path is invalid.", "Upload"); return; }
		await uploadFilesToCurrentPath(files, currentAbsPath, async () => {
			await refresh();
			if (target) target.value = '';
		});
	}

	async function onUpload() { fileInput?.click(); }

	// --- RENAME ACTION ---
	async function onRename(name: string) {
		const currentEntries = get(entries);
		const currentAbsPath = get(currentPath);

		if (!currentAbsPath || currentAbsPath.startsWith('/error')) {
			handleError("Cannot rename: Current path is invalid.", "Rename Setup");
			return;
		}

		// Define the modal configuration object
		const modalConfig = {
			title: `Rename "${name}"`,
			placeholder: "Enter new name",
			initialValue: name,
			confirmOnly: false,
			// ** Ensure these are provided **
			confirmText: 'Rename',
			cancelText: 'Cancel',
			confirmClass: 'btn-primary', // Standard primary button
			onCancel: () => {
				console.log(`[ExplorerLayout:onRename] Rename operation for "${name}" cancelled by user.`);
			},
			onSave: async (newInputValue?: string) => {
				const newName = newInputValue?.trim();

				if (!newName) {
					toastStore.addToast('New name cannot be empty.', 'alert-warning');
					return;
				}
				if (newName === name) {
					toastStore.addToast('Name unchanged.', 'alert-info');
					return;
				}

                const originalEntry = currentEntries.find(entry => entry?.name === name);
                const existingEntryWithNewName = currentEntries.find(entry => entry?.name === newName);

                if (existingEntryWithNewName) {
                    const existingType = existingEntryWithNewName.isDirectory ? 'folder' : 'file';
                    toastStore.addToast(`Cannot rename: A ${existingType} named "${newName}" already exists.`, 'alert-error');
                    return; // Prevent rename if conflict exists
                } else {
                    // No conflict, proceed with rename
                    try {
                        console.log(`[ExplorerLayout:onRename:onSave] Invoking rename_fs_entry_rust: Dir='${currentAbsPath}', Old='${name}', New='${newName}'`);
                        await invoke('rename_fs_entry_rust', {
							directoryPath: currentAbsPath,
							oldName: name,
							newName: newName
						});
                        handleSuccess(`Renamed "${name}" to "${newName}"`, 'File Operation');
						await refresh(); // Refresh list after success
					}
					catch (error) {
						handleError(error, `Renaming ${name} to ${newName}`);
					}
                }
			} // End onSave
		}; // End modalConfig

		// ** Log the config before opening **
		console.log('[ExplorerLayout:onRename] Opening modal with config:', JSON.stringify(modalConfig, null, 2)); // Use stringify for complex objects
		openModal(modalConfig); // Open the modal
	} // End onRename

	// --- DELETE ACTION ---
	async function onDelete(name: string) {
		// Define the modal configuration object
		const modalConfig = {
			title: "Confirm Deletion",
            message: `Are you sure you want to permanently delete "${name}"? This cannot be undone.`,
			confirmOnly: false,
			// ** Ensure these are provided **
			confirmText: 'Delete',
            cancelText: 'Cancel',
            confirmClass: 'btn-error', // Use error color for destructive action
			onCancel: () => {
				console.log(`[ExplorerLayout:onDelete] Delete operation for "${name}" cancelled by user.`);
			},
			onSave: async () => {
				try {
					const currentAbsPath = get(currentPath);
                    if (!currentAbsPath || currentAbsPath.startsWith('/error')) { throw new Error("Current path is invalid for delete."); }
					console.log(`[ExplorerLayout:onDelete:onSave] Calling deleteEntry store function for name: ${name}`);
					await deleteEntry(name); // Assumes this calls invoke('delete_fs_entry_rust', ...) internally
					toastStore.addToast(`Deleted "${name}"`, 'alert-warning');

					// Refresh map list only if deletion happened within the maps folder structure
					const mapsRootAbsPath = normalizePath(await join(await documentDir(), baseFolder, 'Maps'));
					const normCurrentPath = normalizePath(currentAbsPath);
					if (normCurrentPath && mapsRootAbsPath && normCurrentPath.startsWith(mapsRootAbsPath)) {
                        console.log(`[ExplorerLayout:onDelete:onSave] Deletion occurred within maps structure. Refreshing local maps.`);
                        await refreshLocalMaps();
                    }
                    // No need to call refresh() here as deleteEntry should handle it via fsOperations
				} catch (error) { handleError(error, `Deleting ${name}`); }
			} // End onSave
		}; // End modalConfig

		// ** Log the config before opening **
		console.log('[ExplorerLayout:onDelete] Opening modal with config:', JSON.stringify(modalConfig, null, 2));
		openModal(modalConfig); // Open the modal
	} // End onDelete

	// --- NEW FOLDER ACTION ---
	async function onNewFolder() {
        const currentEntries = get(entries);
		// Define the modal configuration object
		const modalConfig = {
			title: 'Create New Folder',
            placeholder: 'Enter folder name',
            initialValue: '',
            confirmOnly: false,
			// ** Ensure these are provided **
            confirmText: 'Create',
            cancelText: 'Cancel',
            confirmClass: 'btn-primary', // Standard primary button
            onCancel: () => {
				console.log(`[ExplorerLayout:onNewFolder] Create folder cancelled by user.`);
			},
			onSave: async (folderName?: string) => {
                const trimmedName = folderName?.trim();
				if (!trimmedName) { toastStore.addToast('Folder name cannot be empty.', 'alert-warning'); return; }

                const existingEntry = currentEntries.find(entry => entry?.name === trimmedName);
                if (existingEntry) {
                    const existingType = existingEntry.isDirectory ? 'folder' : 'file';
                    toastStore.addToast(`Cannot create: A ${existingType} named "${trimmedName}" already exists.`, 'alert-error');
                    return;
                }

				try {
                    console.log(`[ExplorerLayout:onNewFolder:onSave] Calling newFolder store function for name: ${trimmedName}`);
                    await newFolder(trimmedName); // Assumes this calls invoke('create_directory_rust', ...) internally
                    handleSuccess(`Folder "${trimmedName}" created`, 'File Operation');
                    // No need to call refresh() here as newFolder should handle it
                }
				catch (error) { handleError(error, `Creating folder ${trimmedName}`); }
			} // End onSave
		}; // End modalConfig

		// ** Log the config before opening **
		console.log('[ExplorerLayout:onNewFolder] Opening modal with config:', JSON.stringify(modalConfig, null, 2));
		openModal(modalConfig); // Open the modal
	} // End onNewFolder

	// --- NEW FILE ACTION ---
	async function onNewFile() {
        const currentEntries = get(entries);
		// Define the modal configuration object
		const modalConfig = {
			title: 'Create New File',
            placeholder: 'Enter file name',
            initialValue: '',
            confirmOnly: false,
			// ** Ensure these are provided **
            confirmText: 'Create',
            cancelText: 'Cancel',
            confirmClass: 'btn-primary', // Standard primary button
            onCancel: () => {
				console.log(`[ExplorerLayout:onNewFile] Create file cancelled by user.`);
			},
			onSave: async (fileName?: string) => {
                const trimmedName = fileName?.trim();
				if (!trimmedName) { toastStore.addToast('File name cannot be empty.', 'alert-warning'); return; }

                const existingEntry = currentEntries.find(entry => entry?.name === trimmedName);
                 if (existingEntry) {
                    const existingType = existingEntry.isDirectory ? 'folder' : 'file';
                    toastStore.addToast(`Cannot create: A ${existingType} named "${trimmedName}" already exists.`, 'alert-error');
                    return;
                }

				try {
                    console.log(`[ExplorerLayout:onNewFile:onSave] Calling newFile store function for name: ${trimmedName}`);
                    await newFile(trimmedName); // Assumes this calls invoke('create_empty_file_rust', ...) internally
                    handleSuccess(`File "${trimmedName}" created`, 'File Operation');
                    // No need to call refresh() here as newFile should handle it
                }
				catch (error) { handleError(error, `Creating file ${trimmedName}`); }
			} // End onSave
		}; // End modalConfig

		// ** Log the config before opening **
		console.log('[ExplorerLayout:onNewFile] Opening modal with config:', JSON.stringify(modalConfig, null, 2));
		openModal(modalConfig); // Open the modal
	} // End onNewFile

	async function openCurrentPathInExplorer() {
		const path = get(currentPath);
		if (!path || path.startsWith('/error')) { handleError('Current path is not available or invalid.', 'Open Explorer'); return; }
		try {
            console.log(`[ExplorerLayout:openCurrentPathInExplorer] Revealing path: ${path}`);
            await revealItemInDir(path);
        }
		catch (error) { handleError(error, `Failed to reveal path: ${path}`); }
	}

	async function handleCreateDirectory() {
		const path = get(currentPath);
		if (!path || path.startsWith('/error')) { handleError("Cannot create directory: Path is invalid.", "Create Directory"); return; }
		try {
            console.log(`[ExplorerLayout:handleCreateDirectory] Calling createDirectory store function for path: ${path}`);
			await createDirectory(path); // Assumes this calls invoke('create_directory_rust', ...) internally
            const folderName = path.split(/[/\\]/).pop() || 'Folder'; // Get last part of path
			handleSuccess(`Folder "${folderName}" created successfully.`, 'File Operation');
			await refresh(); // Refresh after creating the base/missing folder
		} catch (error) { handleError(error, `Creating directory ${path} from layout`); }
	}

	// Reactive check for missing folders
	$: {
		const normCurrent = normalizePath(get(currentPath));
		const normBase = normalizePath($absoluteBaseFolderPath);
		isBaseSkaterXlFolderMissing = ($directoryStatus === ListingStatus.DoesNotExist && !!normBase && !normBase.startsWith('/error') && normCurrent === normBase);
		isGenericModFolderMissing = ($directoryStatus === ListingStatus.DoesNotExist && (!normBase || normCurrent !== normBase));
	}
</script>

<DropOverlay show={isDraggingOverZone} />

<!-- Main flex container -->
<div class="flex h-full w-full bg-base-300">

	<!-- Main Content Area -->
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

		<!-- Content Row (Tabs + File List) -->
		<div class="flex h-full mb-16.5 w-full overflow-hidden gap-4"> 
			<TabSwitcher
				{tabs}
				currentPath={$currentPath}
				baseFolder={$absoluteBaseFolderPath}
				onSwitchTab={handleSwitchTab}
			/>

			<!-- File List Container -->
			<div class="h-full w-full overflow-y-auto rounded-box bg-base-100 p-2 shadow relative min-h-0">
				{#if $directoryStatus === ListingStatus.DoesNotExist}
					<!-- Prompt to create missing folder -->
					<CreateFolderPrompt
						missingPath={$currentPath}
						promptType={isBaseSkaterXlFolderMissing ? 'skaterXlBase' : 'genericMod'}
						onCreate={handleCreateDirectory}
					/>
				{:else if $directoryStatus === ListingStatus.ExistsAndEmpty}
					<!-- Display when folder exists but is empty -->
                	<div class="flex h-full items-center justify-center text-center p-4">
						<p class="text-base-content/60">This folder is empty.</p>
                	</div>
				{:else}
					<!-- Display File List (or loading spinner) -->
					{#if $isLoading && !$entries.length}
						<!-- Initial loading state for the directory -->
						<div class="absolute inset-0 flex items-center justify-center text-center p-4 z-10 bg-base-100/50 rounded-box">
							<span class="loading loading-spinner loading-lg"></span>
						</div>
					{/if}
                	{#key $currentPath} <!-- Re-render FileList when path changes -->
				    	<FileList
        entries={$entries}
        loading={$isLoading && $entries.length > 0}
        onOpenDirectory={openDirectory} 
        {onRename} 
        {onDelete} 
    />
                	{/key}
				{/if}
			</div> <!-- End File List Container -->
		</div> <!-- End Content Row -->
	</div> <!-- End Main Content Area -->

	<!-- Hidden file input for uploads -->
	<input type="file" multiple bind:this={fileInput} on:change={handleFileChange} class="hidden" />
</div> <!-- End Main flex container -->