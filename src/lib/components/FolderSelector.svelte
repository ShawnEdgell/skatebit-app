<!-- src/lib/components/FolderSelector.svelte -->
<script lang="ts">
	import { open as openDialog } from '@tauri-apps/plugin-dialog';
	import { mapsFolder } from '$lib/stores/mapsFolderStore';
	// get from svelte/store is no longer needed here
	import { openModal } from '$lib/stores/modalStore';
	import { toastStore } from '$lib/stores/toastStore';
	import { refreshLocalMaps } from '$lib/stores/localMapsStore';
	import { documentDir, join, normalize } from '@tauri-apps/api/path'; // Added join/normalize
	import { normalizePath } from '$lib/ts/pathUtils';
	import { handleError, handleSuccess } from '$lib/ts/errorHandler';

	async function selectFolder() {
		openModal({
			title: 'Change Maps Folder?',
			message:
				'By default, Skater XL looks for maps in Documents/SkaterXL/Maps.\nChanging this requires manual game configuration.\n\nProceed with selecting a new folder?',
			confirmText: 'Select Folder',
			cancelText: 'Cancel',
			confirmOnly: false,
			onSave: async () => {
				try {
                    // --- FIX: Await the async get() method ---
					const currentFolder = await mapsFolder.get(); // Await the promise
                    // --- END FIX ---

					const selected = await openDialog({
						directory: true,
						multiple: false,
						title: 'Select SkaterXL Maps Folder',
						defaultPath: currentFolder ?? undefined, // currentFolder is now string | null
					});

					if (typeof selected === 'string' && selected.trim() !== '') {
						const normalizedSelected = normalizePath(selected);
						const normalizedCurrent = normalizePath(currentFolder);

						if (normalizedSelected && normalizedSelected !== normalizedCurrent) {
							await mapsFolder.set(normalizedSelected);
							handleSuccess(`Maps folder updated`, 'Installation');
							await refreshLocalMaps(); // Refresh after setting

							const docDir = normalizePath(await documentDir());
							// --- FIX: Check docDir before using startsWith ---
							if (docDir && normalizedSelected.startsWith(docDir)) {
                                // Path is inside docs - this is expected for refreshLocalMaps
							} else if (docDir) {
                                // Path is outside docs
								toastStore.addToast(`Selected folder is outside Documents. Map list may be empty.`, 'alert-warning');
							} else {
                                // Could not get docDir
                                handleError("Could not verify if path is inside Documents.", "Folder Selection");
                            }
                            // --- END FIX ---

						} else if (normalizedSelected && normalizedSelected === normalizedCurrent) {
							toastStore.addToast(`Maps folder unchanged.`, 'alert-info');
						}
					} else if (selected === null) {
						console.log('User cancelled folder selection dialog.');
					} else {
						console.warn('Expected a single folder, but received:', selected);
					}
				} catch (err) {
					handleError(err, 'Selecting Folder');
				}
			},
		});
	}
</script>

<button on:click={selectFolder}> Change Maps Folder </button>