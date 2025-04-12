<!-- src/lib/components/FolderSelector.svelte -->
<script lang="ts">
  import { open as openDialog } from '@tauri-apps/plugin-dialog';
  import { mapsFolder } from "$lib/stores/mapsFolderStore";
  import { get } from "svelte/store";
  import { openModal } from '$lib/stores/modalStore';
  import { toastStore } from '$lib/stores/toastStore';
  import { refreshLocalMaps } from '$lib/stores/localMapsStore'; // Import refresh

  async function selectFolder() {
      openModal({
          title: "Change Maps Folder?",
          message: "By default, Skater XL expects maps in Documents/SkaterXL/Maps.\nChanging this requires manual game configuration (see Discord tutorials).\n\nProceed with selecting a new folder?",
          confirmOnly: true,
          onSave: async () => {
              try {
                const currentFolder = get(mapsFolder); // Get current value for default path
                const selected = await openDialog({
                  directory: true,
                  multiple: false,
                  title: "Select SkaterXL Maps Folder",
                  defaultPath: currentFolder || undefined // Use current or let OS decide
                });

                if (typeof selected === "string" && selected.trim() !== "" && selected !== currentFolder) {
                   console.log("Setting and saving new maps folder:", selected);
                   // mapsFolder.set already saves it (based on store modification above)
                   await mapsFolder.set(selected); // Use await here if set is async
                   toastStore.addToast(`Maps folder updated`, 'alert-info'); // Simplified toast

                   // *** Refresh the map list using the new path ***
                   await refreshLocalMaps();

                } else if (selected === null) {
                  console.log("User cancelled folder selection dialog.");
                } else if (selected === currentFolder) {
                   toastStore.addToast(`Maps folder unchanged.`, 'alert-info');
                }
                 else {
                  console.warn("Expected a single folder, but received:", selected);
                }
              } catch (err) {
                 console.error("Error opening folder dialog:", err);
                 toastStore.addToast(`Error selecting folder: ${err}`, 'alert-error');
              }
          },
      });
  }
</script>

<button on:click={selectFolder}>
  Change Maps Folder
</button>