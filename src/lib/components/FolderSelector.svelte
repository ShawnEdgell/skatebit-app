<script lang="ts">
	import { open as openDialog } from '@tauri-apps/plugin-dialog';
    import { invoke } from '@tauri-apps/api/core';
	import { mapsFolder } from '$lib/stores/mapsFolderStore';
	import { modalStore, openModal } from '$lib/stores/modalStore';
	import { toastStore } from '$lib/stores/toastStore';
	import { refreshLocalMaps } from '$lib/stores/localMapsStore';
	import { documentDir, join } from '@tauri-apps/api/path';
	import { tick } from 'svelte';
	import { normalizePath } from '$lib/ts/pathUtils';
	import { handleError, handleSuccess } from '$lib/ts/errorHandler';
	// Assuming updateSymlink is still needed if you select a non-default folder
	import { updateSymlink } from '$lib/ts/symlinkHelper';

	// Reset to default sets the maps folder back to Documents/SkaterXL/Maps.
	async function resetToDefault() {
        try {
            // --- 1. Calculate Default Path ---
            const docDirResult = await documentDir();
            if (docDirResult === null) {
                handleError(new Error("Could not determine Documents directory."), "Resetting to default");
                return;
            }
            const docDir = normalizePath(docDirResult);
            // Use 'as string' assertion since we checked for null
            const defaultFolder = await join(docDir as string, "SkaterXL", "Maps");
            const normalizedDefault = normalizePath(defaultFolder ?? "");

            // --- 2. Remove Potential Symlink ---
            try {
                console.log(`[ResetDefault] Attempting to remove potential symlink at: ${normalizedDefault}`);
                await invoke('remove_maps_symlink', { linkPathStr: normalizedDefault });
                console.log(`[ResetDefault] Symlink check/removal completed for: ${normalizedDefault}`);
            } catch (symlinkErr) {
                console.error(`[ResetDefault] Error during symlink removal attempt: ${symlinkErr}`);
                handleError(symlinkErr, "Removing Symlink");
                toastStore.addToast(
                    "Could not automatically remove old symlink (if any). Check permissions or remove manually.",
                    "alert-warning", 7000
                );
            }

            // --- 3. Ensure Default Directory Exists ---
            try {
                console.log(`[ResetDefault] Ensuring default directory exists: ${normalizedDefault}`);
                // Use the correct argument name 'absolutePath'
                await invoke('create_directory_rust', { absolutePath: normalizedDefault });
                console.log(`[ResetDefault] Directory check/creation process completed for: ${normalizedDefault}`);
            } catch(createDirErr) {
                console.error(`[ResetDefault] Error ensuring default directory exists: ${createDirErr}`);
                handleError(createDirErr, "Creating Default Directory");
                toastStore.addToast(
                    "Could not create the default Maps folder. Check permissions.", "alert-error", 7000
                );
                // Optional: return; // Stop if directory creation fails?
            }

            // --- 4. Update Store and Refresh UI ---
            await mapsFolder.set(normalizedDefault);
            handleSuccess("Maps folder reset to default", "Installation");
            await refreshLocalMaps();
            await tick();

        } catch (err) {
            handleError(err, "Resetting to default (Main Process)");
        }
    } // end resetToDefault

	async function selectFolder() {
        const currentFolder = await mapsFolder.get();
        // Use 'as string' assertion if you're confident normalizePath handles null input from get()
        const normalizedCurrent = normalizePath(currentFolder ?? "");

        const docDirResult = await documentDir();
        let defaultFolder: string | null = null;
        let normalizedDefault: string | null = null;
        let currentDocDir: string | null = null; // Store normalized doc dir

        if (docDirResult !== null) {
            currentDocDir = normalizePath(docDirResult); // Store for later use
            try {
                // Use 'as string' assertion
                defaultFolder = await join(currentDocDir as string, "SkaterXL", "Maps");
                normalizedDefault = defaultFolder ? normalizePath(defaultFolder) : null;
            } catch (err) {
                handleError(err, "Calculating Default Folder Path");
            }
        } else {
            console.error("[SelectFolder] Could not determine Documents directory.");
            // Potentially show a toast?
        }

        // Build the modal configuration object.
        let modalConfig: any = {
            title: 'Change Maps Folder?',
            message: `This feature changes your Skater XL maps location using a system shortcut (Symbolic Link) at Documents/SkaterXL/Maps.<br><br><strong class="text-warning">Administrator Privileges Needed:</strong> Please restart this application as Administrator, otherwise the link won't be created and the game won't find your maps.<br><br>Your active map folder will be safely renamed as a backup and added to your Documents (e.g., Maps_backup).<br><br>Type "<strong>I understand</strong>" to continue.`,
            confirmText: 'Select Folder',
            cancelText: 'Cancel',
            confirmOnly: false,
            placeholder: "I understand",
            // --- *** ADD THIS LINE FOR BUTTON COLOR *** ---
            confirmClass: 'btn-primary', // Use DaisyUI primary button style (usually blue)
            // ----------------------------------------------
            onSave: async (inputValue?: string) => {
                // Note: The 'inputValue' here is "I understand", not the selected path.
                // We only proceed to the dialog if the input matches.

                // Find doc dir again inside onSave in case it matters for logic below
                const docDirOnSaveResult = await documentDir();
                const docDirOnSave = docDirOnSaveResult ? normalizePath(docDirOnSaveResult) : null;

                try {
                    const currentFolderInner = await mapsFolder.get();
                    const normCurrentInner = normalizePath(currentFolderInner ?? "");

                    // Open the actual folder selection dialog
                    const selected = await openDialog({
                        directory: true,
                        multiple: false,
                        title: 'Select Your SkaterXL Maps Folder',
                        // Use current folder from store as starting point
                        defaultPath: currentFolderInner ?? undefined,
                    });

                    if (typeof selected === 'string' && selected.trim() !== '') {
                        const normalizedSelected = normalizePath(selected); // Normalize the selected path

                        // Re-calculate default path inside onSave for accurate comparison
                        let currentNormalizedDefault: string | null = null;
                        if (docDirOnSave) {
                            try {
                                const defaultFolderInner = await join(docDirOnSave as string, "SkaterXL", "Maps");
                                currentNormalizedDefault = defaultFolderInner ? normalizePath(defaultFolderInner) : null;
                            } catch (err) { console.error("Error recalculating default path in onSave:", err); }
                        }

                        // Only proceed if a folder was selected AND it's different from the current one
                        if (normalizedSelected && normalizedSelected !== normCurrentInner) {
                            await mapsFolder.set(normalizedSelected);
                            handleSuccess("Maps folder updated", "Installation");

                            // Decide whether to update/remove symlink
                            if (currentNormalizedDefault && normalizedSelected !== currentNormalizedDefault) {
                                // Selected a custom folder, create/update symlink
                                console.log(`[SelectFolder:onSave] Updating symlink for custom path: ${normalizedSelected}`);
                                // Ensure updateSymlink knows the target path (the default location)
                                await updateSymlink(normalizedSelected);
                            } else if (currentNormalizedDefault && normalizedSelected === currentNormalizedDefault) {
                                // Selected the default folder, remove any existing symlink
                                console.log(`[SelectFolder:onSave] Selected default path. Removing symlink at: ${currentNormalizedDefault}`);
                                try {
                                    await invoke('remove_maps_symlink', { linkPathStr: currentNormalizedDefault });
                                } catch (symlinkErr) { handleError(symlinkErr, "Removing Symlink (on Default Select)"); }
                            } else {
                                console.warn("[SelectFolder:onSave] Cannot determine default path, skipping symlink logic.");
                            }

                            // Refresh map lists AFTER setting path and handling symlink
                            await refreshLocalMaps();
                            await tick();

                            // Optional warning if outside Documents
                            if (docDirOnSave && !normalizedSelected.startsWith(docDirOnSave)) {
                                toastStore.addToast("Selected folder is outside Documents. Map list may be empty if game doesn't support it.", "alert-warning");
                            }

                        } else if (normalizedSelected && normalizedSelected === normCurrentInner) {
                            toastStore.addToast("Maps folder unchanged.", "alert-info");
                        }
                    } else if (selected === null) {
                        console.log("[SelectFolder:onSave] User cancelled folder selection dialog.");
                    } else {
                        // Should not happen for directory selection
                        console.warn("[SelectFolder:onSave] Folder selection dialog returned unexpected value:", selected);
                    }
                } catch (err) {
                    handleError(err, "Processing Selected Folder");
                }
            } // end onSave
        }; // end modalConfig

        // Add the Reset to Default secondary action ONLY if the current folder is not the default
        // And only if we could calculate the default path
        if (normalizedDefault !== null && normalizedCurrent !== normalizedDefault) {
            modalConfig.secondaryText = "Reset to Default";
            modalConfig.onSecondary = async () => {
                // No need to check input here, just reset
                await resetToDefault();
            };
        } else if (normalizedDefault === null) {
            console.log("[SelectFolder] Cannot determine default path, 'Reset to Default' button will be hidden.");
        }

        // Finally, open the modal with the constructed configuration
        openModal(modalConfig);

    } // end selectFolder

</script>

<!-- Button remains the same -->
<button on:click={selectFolder}>Change Maps Folder</button>