<script lang="ts">
  import type { DirEntry } from '@tauri-apps/plugin-fs';
  export let entries: DirEntry[] = [];
  export let onOpenDirectory: (name: string) => void;
  export let onRename: (name: string) => void;
  export let onDelete: (name: string) => void;
</script>

<div class="overflow-y-auto h-96 bg-base-200 p-2 w-full">
  {#if entries.length > 0}
    <ul class="menu w-full">
      {#each entries as entry}
        <li>
          <div class="flex items-center">
            <div class="flex-1 overflow-hidden">
              {#if entry.isDirectory}
                <button class="w-full text-left p-1 truncate" on:click={() => onOpenDirectory(entry.name)}>
                  📁 {entry.name}
                </button>
              {:else}
                <span class="block p-1 truncate">
                  📄 {entry.name}
                </span>
              {/if}
            </div>
            <div class="flex gap-1 ml-2">
              <button class="btn btn-xs btn-warning" on:click={() => onRename(entry.name)}>✏️</button>
              <button class="btn btn-xs btn-error" on:click={() => onDelete(entry.name)}>🗑️</button>
            </div>
          </div>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="text-warning h-96 flex items-center justify-center">No files found or an error occurred.</p>
  {/if}
</div>
