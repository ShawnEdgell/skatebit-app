<!-- src/lib/components/FileList.svelte -->
<script lang="ts">
  import type { DirEntry } from '@tauri-apps/plugin-fs';
  export let entries: DirEntry[] = [];
  export let onOpenDirectory: (name: string) => void;
  export let onRename: (name: string) => void;
  export let onDelete: (name: string) => void;
</script>

<div class="overflow-y-auto h-96 bg-base-200 w-full">
  {#if entries.length > 0}
    <ul class="menu w-full">
      {#each entries as entry}
        <li>
          <div class="flex items-center">
            <div class="flex justify-between w-full overflow-hidden">
              {#if entry.isDirectory}
                <button
                  class="w-full text-left"
                  on:click={() => onOpenDirectory(entry.name)}
                  title={entry.name}>
                  <span class="inline-block truncate max-w-96">📁 {entry.name}</span>
                </button>
              {:else}
                <span class="block truncate max-w-96" title={entry.name}>📄 {entry.name}</span>
              {/if}
            </div>
            <div class="flex ml-2 gap-1">
              <button class="btn btn-xs btn-warning" on:click={() => onRename(entry.name)}>✏️</button>
              <button class="btn btn-xs btn-error" on:click={() => onDelete(entry.name)}>🗑️</button>
            </div>
          </div>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="text-warning h-96 flex items-center justify-center">
      No files found or an error occurred.
    </p>
  {/if}
</div>
