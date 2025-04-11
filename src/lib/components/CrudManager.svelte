<!-- src/lib/components/CrudManager.svelte -->
<script lang="ts">
  import CrudModal from "$lib/components/CrudModal.svelte";
  import { createEventDispatcher } from "svelte";
  // Import FS operations:
  import { renameEntry, createFolder, createFile, deleteEntry } from "$lib/ts/fsOperations";
  import { toastStore } from "$lib/stores/toastStore";
  import { explorerStore } from "$lib/stores/explorerStore";
  // Import the local maps refresh function
  import { refreshLocalMaps } from "$lib/stores/localMaps";

  export let open: boolean = false;
  export let action: "rename" | "newFolder" | "newFile" | "delete" = "rename";
  export let currentPath: string = "";
  export let currentName: string = "";

  const dispatch = createEventDispatcher();

  let modalTitle = "";
  let modalPlaceholder = "";
  let initialValue = "";
  let confirmOnly = false;

  $: {
    if (action === "rename") {
      modalTitle = `Rename "${currentName}"`;
      modalPlaceholder = "Enter new name";
      initialValue = currentName;
      confirmOnly = false;
    } else if (action === "newFolder") {
      modalTitle = "Create New Folder";
      modalPlaceholder = "Enter folder name";
      initialValue = "";
      confirmOnly = false;
    } else if (action === "newFile") {
      modalTitle = "Create New File";
      modalPlaceholder = "Enter file name";
      initialValue = "";
      confirmOnly = false;
    } else if (action === "delete") {
      modalTitle = `Delete "${currentName}"?`;
      modalPlaceholder = "";  // no input required if you want immediate deletion
      initialValue = "";
      confirmOnly = true;
    }
  }

  async function handleSave(event: CustomEvent<{ value: string }>) {
    const { value } = event.detail;
    try {
      if (action === "rename") {
        await renameEntry(currentPath, currentName, value);
        toastStore.addToast(`Renamed "${currentName}" to "${value}"`, "alert-info", 3000);
      } else if (action === "newFolder") {
        await createFolder(currentPath, value);
        toastStore.addToast(`Folder "${value}" created successfully`, "alert-success", 3000);
      } else if (action === "newFile") {
        await createFile(currentPath, value);
        toastStore.addToast(`File "${value}" created successfully`, "alert-success", 3000);
      } else if (action === "delete") {
        // For deletion, immediately delete without checking user input.
        await deleteEntry(currentPath, currentName);
        toastStore.addToast(`Deleted "${currentName}" successfully`, "alert-warning", 3000);
        // Refresh the local maps store after deletion.
        await refreshLocalMaps();
      }
      // Optionally also refresh the explorer store.
      await explorerStore.refresh();
      dispatch("crudSuccess");
    } catch (error) {
      console.error("CRUD error:", error);
      dispatch("crudError", { error });
    }
    open = false;
  }

  function handleCancel() {
    open = false;
    dispatch("crudCancel");
  }
</script>

{#if open}
  <CrudModal
    bind:open
    title={modalTitle}
    placeholder={modalPlaceholder}
    initialValue={initialValue}
    {confirmOnly}
    on:save={handleSave}
    on:cancel={handleCancel} />
{/if}
