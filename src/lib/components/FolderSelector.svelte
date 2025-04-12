<!-- src/lib/components/FolderSelector.svelte -->
<script lang="ts">
  import { open } from '@tauri-apps/plugin-dialog';
  import { mapsFolder } from "$lib/stores/mapsFolderStore";
  import { get } from "svelte/store";
  import CrudModal from "$lib/components/CrudModal.svelte";

  let showModal = false;
  let modalTitle = "Change Maps Folder";
  let modalMessage = "Skater XL expects maps to appear in Documents/SkaterXL/Maps. Changing this folder will not automatically update the default linking for the game. Please follow the Discord tutorials for instructions if you change this folder.";
  let confirmOnly = true;

  function selectFolder() {
    showModal = true;
  }

  async function handleModalSave(event: CustomEvent<{ value: string }>) {
    showModal = false;
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Maps Folder",
        defaultPath: get(mapsFolder)
      });
      if (typeof selected === "string" && selected.trim() !== "") {
        mapsFolder.set(selected);
      } else if (selected === null) {
        console.log("User cancelled folder selection.");
      } else {
        console.error("Expected a single folder, but received:", selected);
      }
    } catch (err) {
      console.error("Error opening folder dialog:", err);
    }
  }

  function handleModalCancel() {
    showModal = false;
  }
</script>

{#if showModal}
  <CrudModal
    bind:open={showModal}
    title={modalTitle}
    message={modalMessage}
    placeholder={modalMessage}
    initialValue=""
    confirmOnly={confirmOnly}
    on:save={handleModalSave}
    on:cancel={handleModalCancel} />
{/if}

<button on:click={selectFolder}>
  Change Maps Folder
</button>
