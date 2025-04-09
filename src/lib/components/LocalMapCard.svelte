<!-- src/lib/components/LocalMapCard.svelte -->
<script lang="ts">
  import type { DirEntry } from '@tauri-apps/plugin-fs';
  import GenericCard from '$lib/components/GenericCard.svelte';
  import { documentDir, join } from '@tauri-apps/api/path';
  import { revealItemInDir } from '@tauri-apps/plugin-opener';
  import { deleteEntry, baseFolder } from '$lib/ts/fsOperations';
  import { normalizePath } from '$lib/ts/pathUtils';
  import { createEventDispatcher } from 'svelte';

  export let localMap: DirEntry;
  const dispatch = createEventDispatcher();

  const relativeMapsFolder = normalizePath(`${baseFolder}/Maps`);

  // Converts file size (bytes) to a human-readable string.
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
      await revealItemInDir(absolutePath);
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

<GenericCard
  fallbackIcon={localMap.isDirectory ? "📁" : "📄"}
  badgeText={!localMap.isDirectory && typeof (localMap as any).size === 'number'
    ? formatFileSize((localMap as any).size)
    : ''}
  title={localMap.name}
>
  <span slot="overlay">
    <button
      class="btn btn-secondary btn-sm pointer-events-auto"
      on:click|preventDefault|stopPropagation={openInExplorer}
      title="Open in File Explorer"
    >
      Open
    </button>
    <button
      class="btn btn-error btn-sm pointer-events-auto"
      on:click|preventDefault|stopPropagation={handleDelete}
      title="Delete Local Map"
    >
      Delete
    </button>
  </span>
</GenericCard>
