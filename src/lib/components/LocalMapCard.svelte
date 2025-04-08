<!-- src/lib/components/LocalMapCard.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { DirEntry } from '@tauri-apps/plugin-fs';
  // Use Tauri 2.0 shell plugin import:
  import { open } from '@tauri-apps/plugin-shell';
  import { deleteEntry, baseFolder } from '$lib/ts/fsOperations';
  import { normalizePath } from '$lib/ts/pathUtils';

  // Expect a DirEntry for a local map.
  export let localMap: DirEntry;
  const dispatch = createEventDispatcher();

  // Define the local maps folder path (assumed to be at Documents/SkaterXL/Maps)
  const localMapsFolder = normalizePath(`${baseFolder}/Maps`);
  const fullPath = `${localMapsFolder}/${localMap.name}`;

  let deleteInProgress = false;

  async function openInExplorer(e: MouseEvent) {
    e.preventDefault();
    try {
      await open(`file://${fullPath}`);
    } catch (error) {
      console.error("Error opening in file explorer:", error);
    }
  }

  async function handleDelete(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (deleteInProgress) return;
    deleteInProgress = true;
    try {
      const deleted = await deleteEntry(localMapsFolder, localMap.name);
      if (deleted) {
        // Only dispatch the deletion event if the fs operation confirmed deletion.
        dispatch("deleted", { name: localMap.name });
      }
    } catch (error) {
      console.error("Error deleting local map:", error);
    }
    deleteInProgress = false;
  }
</script>

<div role="listitem" class="relative rounded-lg card shadow-md overflow-hidden flex-shrink-0 group aspect-video bg-base-200 w-96">
  {#if localMap.isDirectory}
    <div class="absolute inset-0 grid place-content-center text-6xl">📁</div>
  {:else}
    <div class="absolute inset-0 grid place-content-center text-6xl">📄</div>
  {/if}
  <div class="absolute bottom-0 z-10 w-full p-3 bg-gradient-to-t from-black/60 to-transparent pointer-events-none">
    <span class="font-semibold text-lg text-white drop-shadow-md line-clamp-2">{localMap.name}</span>
  </div>
  <div class="absolute inset-0 z-20 flex items-center justify-center gap-3 bg-neutral/70 opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none">
    <button 
      class="btn btn-secondary btn-sm pointer-events-auto" 
      on:click|preventDefault|stopPropagation={openInExplorer} 
      title="Open in File Explorer">
      Open
    </button>
    <button 
      class="btn btn-error btn-sm pointer-events-auto" 
      on:click|preventDefault|stopPropagation={handleDelete} 
      title="Delete Local Map">
      Delete
    </button>
  </div>
</div>
