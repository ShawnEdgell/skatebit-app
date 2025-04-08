<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { DirEntry } from '@tauri-apps/plugin-fs';
  import { documentDir, join } from '@tauri-apps/api/path';
  // Import the CORRECT functions from opener plugin
  import { revealItemInDir } from '@tauri-apps/plugin-opener';
  import { deleteEntry, baseFolder } from '$lib/ts/fsOperations';
  import { normalizePath } from '$lib/ts/pathUtils';

  export let localMap: DirEntry;
  const dispatch = createEventDispatcher();

  const relativeMapsFolder = normalizePath(`${baseFolder}/Maps`);

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  let deleteInProgress = false;

  async function openInExplorer(e: MouseEvent) {
    e.preventDefault();
    try {
      const docsDir = await documentDir();
      const absolutePath = await join(docsDir, baseFolder, "Maps", localMap.name);
      console.log(`Constructed path: ${absolutePath}`);

      // We can directly use revealItemInDir for both files and directories
      // as it opens the containing folder and selects the item.
      console.log(`Attempting opener.revealItemInDir for: ${absolutePath}`);
      await revealItemInDir(absolutePath);
      console.log("Opener command successful.");

      // --- Alternative using openPath for directories ---
      // if (localMap.isDirectory) {
      //   console.log(`Attempting opener.openPath for directory: ${absolutePath}`);
      //   await openPath(absolutePath); // Opens the directory itself
      // } else {
      //   console.log(`Attempting opener.revealItemInDir for file: ${absolutePath}`);
      //   await revealItemInDir(absolutePath); // Reveals the file in its folder
      // }
      // console.log("Opener command successful.");
      // --- End Alternative ---

    } catch (error) {
      console.error("Error using opener plugin:", error);
    }
  }

  async function handleDelete(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (deleteInProgress) return;
    deleteInProgress = true;
    try {
      const deleted = await deleteEntry(relativeMapsFolder, localMap.name);
      if (deleted) {
        dispatch("deleted", { name: localMap.name });
      }
    } catch (error) {
      console.error("Error deleting local map (caught in component):", error);
    }
    deleteInProgress = false;
  }
</script>

<!-- Template remains the same -->
<div role="listitem" class="relative rounded-lg card shadow-md overflow-hidden flex-shrink-0 group aspect-video bg-base-200 w-80">
  {#if !localMap.isDirectory && typeof (localMap as any).size === 'number'}
    <span class="absolute top-1 right-1 bg-black/50 text-white text-xs rounded px-2 py-1">
      {formatFileSize((localMap as any).size)}
    </span>
  {/if}

  {#if localMap.isDirectory}
    <div class="absolute inset-0 grid place-content-center text-6xl">📁</div>
  {:else}
    <div class="absolute inset-0 grid place-content-center text-6xl">📄</div>
  {/if}

  <div class="absolute bottom-0 z-10 w-full p-3 bg-gradient-to-t from-black/60 to-transparent pointer-events-none">
    <span class="font-semibold text-lg text-white drop-shadow-md line-clamp-2">{localMap.name}</span>
  </div>

  <div class="absolute inset-0 z-20 flex items-center justify-center gap-3 bg-neutral/70 opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none">
    <button class="btn btn-secondary btn-sm pointer-events-auto" on:click|preventDefault|stopPropagation={openInExplorer} title="Open in File Explorer">
      Open
    </button>
    <button class="btn btn-error btn-sm pointer-events-auto" on:click|preventDefault|stopPropagation={handleDelete} title="Delete Local Map">
      Delete
    </button>
  </div>
</div>