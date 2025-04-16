<!-- src/lib/features/explorer/components/FileList.svelte -->
<script lang="ts">
  import type { FsEntry } from "$lib/types/fsTypes";
  import { formatFileSize } from "$lib/utils/formatter";

  export let entries: FsEntry[] = [];
  export let loading: boolean = false;

  // Updated: onRename now expects two arguments.
  export let onOpenDirectory: (name: string) => void;
  export let onRename: (name: string, itemPath: string) => void;
  // onDelete already expects two arguments.
  export let onDelete: (name: string, itemPath: string) => void;
  export let onCreate: () => void;
  export let missingPath: string | undefined | null = '';

  function safeName(entry: FsEntry | undefined | null): string {
    return entry?.name ?? '';
  }

  function isActionable(entry: FsEntry | undefined | null): boolean {
    return !!entry && entry.name !== null;
  }
</script>

<div class="h-full">
  {#if loading}
    <div class="absolute inset-0 flex items-center justify-center z-10 bg-base-200/50">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  {/if}

  {#if missingPath}
    <!-- Render CreateFolderPrompt (or fallback message) when folder is missing -->
    <div class="flex flex-col h-full items-center justify-center text-center gap-4 p-4">
      <h3 class="text-xl font-semibold text-warning">Folder Not Found</h3>
      <p class="text-base-content/60 w-md">
       The folder doesn't seem to exist yet. Some mods require specific folders. You can create it now if needed.
        
      </p>
      <button class="btn btn-primary btn-sm mt-2" on:click={onCreate}>
        Create Folder Now
      </button>
    </div>
  {:else}
    {#if !loading && entries && entries.length > 0}
      <ul>
        {#each entries as entry (entry?.path ?? Math.random())}
          {#if entry}
            <li>
              <div class="flex justify-between items-center w-full hover:bg-base-300 rounded-lg gap-2">
                {#if entry.isDirectory}
                  <button
                    class="flex items-center flex-1 min-w-0 gap-3 text-left cursor-pointer py-1 px-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                    on:click={() => onOpenDirectory(safeName(entry))}
                    title={safeName(entry)}
                    disabled={!isActionable(entry)}
                  >
                    <span class="text-xl text-info group-hover:text-info-content">📁</span>
                    <span class="truncate flex-1">{safeName(entry) || 'Unnamed Folder'}</span>
                    {#if entry.size != null}
                      <span class="badge badge-xs badge-ghost flex-shrink-0 ml-auto mr-2">
                        {formatFileSize(entry.size)}
                      </span>
                    {/if}
                  </button>
                {:else}
                  <div
                    class="flex items-center flex-1 min-w-0 gap-3 text-left cursor-pointer py-1 px-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span class="text-xl text-base-content/80 group-hover:text-base-content">📄</span>
                    <span class="truncate flex-1">{safeName(entry) || 'Unnamed File'}</span>
                    {#if entry.size != null}
                      <span class="badge badge-xs badge-ghost flex-shrink-0 ml-auto mr-2">
                        {formatFileSize(entry.size)}
                      </span>
                    {/if}
                  </div>
                {/if}

                <div class="flex gap-1 flex-shrink-0">
                  {#if isActionable(entry)}
                    <button
                      title="Rename"
                      class="btn btn-xs btn-ghost text-warning hover:bg-warning hover:text-warning-content"
                      on:click|stopPropagation={() => onRename(safeName(entry), entry.path)}
                    >✏️</button>
                    <button
                      title="Delete"  
                      class="btn btn-xs btn-ghost text-error hover:bg-error hover:text-error-content"
                      on:click|stopPropagation={() => onDelete(safeName(entry), entry.path)}
                    >🗑️</button>
                  {:else}
                    <button class="btn btn-xs btn-ghost" disabled title="Cannot rename unnamed item">✏️</button>
                    <button class="btn btn-xs btn-ghost" disabled title="Cannot delete unnamed item">🗑️</button>
                  {/if}
                </div>
              </div>
            </li>
          {/if}
        {/each}
      </ul>
    {:else if !loading}
      <div class="p-4 h-full flex items-center justify-center">
        <p class="mb-4 text-info ">The folder is empty.</p>
      </div>
    {/if}
  {/if}
</div>
