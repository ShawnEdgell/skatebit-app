<!-- src/lib/components/FolderSelector.svelte -->
<script lang="ts">
	import { open as openDialog } from '@tauri-apps/plugin-dialog';
	import { mapsFolder } from '$lib/stores/mapsFolderStore';
	import { openModal } from '$lib/stores/modalStore';
	import { toastStore } from '$lib/stores/toastStore';
	import { refreshLocalMaps } from '$lib/stores/localMapsStore';
	import { documentDir, join, normalize } from '@tauri-apps/api/path';
	import { normalizePath } from '$lib/ts/pathUtils';
	import { handleError, handleSuccess } from '$lib/ts/errorHandler';

	async function selectFolder() {
		openModal({
	title: 'Change Maps Folder?',
	message: `Skater XL looks for maps in Documents/SkaterXL/Maps.
Changing this requires manual game configuration. (check Discrord for help)

Type "I understand" below to enable folder selection.`,
	confirmText: 'Select Folder',
	cancelText: 'Cancel',
	confirmOnly: false,
	placeholder: "I understand",
	onSave: async (inputValue?: string) => {
				try {
					const currentFolder = await mapsFolder.get();

					const selected = await openDialog({
						directory: true,
						multiple: false,
						title: 'Select SkaterXL Maps Folder',
						defaultPath: currentFolder ?? undefined,
					});

					if (typeof selected === 'string' && selected.trim() !== '') {
						const normalizedSelected = normalizePath(selected);
						const normalizedCurrent = normalizePath(currentFolder);

						if (normalizedSelected && normalizedSelected !== normalizedCurrent) {
							await mapsFolder.set(normalizedSelected);
							handleSuccess(`Maps folder updated`, 'Installation');
							await refreshLocalMaps(); 

							const docDir = normalizePath(await documentDir());
		
							if (docDir && normalizedSelected.startsWith(docDir)) {
                               
							} else if (docDir) {
                              
								toastStore.addToast(`Selected folder is outside Documents. Map list may be empty.`, 'alert-warning');
							} else {                      
                                handleError("Could not verify if path is inside Documents.", "Folder Selection");
                            }

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