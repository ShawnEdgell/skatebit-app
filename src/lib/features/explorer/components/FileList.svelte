<!-- src/lib/components/FileList.svelte -->
<script lang="ts">
  // ---> ADD loading prop back <---
  export let loading: boolean = false;
  export let entries: Array<{ name: string; isDirectory: boolean; size?: number; modifiedAt?: Date | number | null }> = [];
  export let onOpenDirectory: (name: string) => void;
  export let onRename: (name: string) => void;
  export let onDelete: (name: string) => void;

  // Example formatter function (keep as is)
  function formatFileSize(bytes: number | undefined): string {
    if (bytes === undefined || isNaN(bytes)) return '';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
</script>

<div class="overflow-y-auto h-96 bg-base-200 w-full p-2 rounded-box relative">

  {#if loading}
    <!-- Loading Indicator -->
    <div class="absolute inset-0 flex items-center justify-center text-center p-4 z-10">
      <span class="loading loading-spinner loading-lg"></span>
      <!-- Optional: <p class="ml-2">Loading...</p> -->
    </div>
  {:else if entries.length > 0}
    <!-- Data Loaded - Has Entries -->
    <ul class=" w-full p-0">
      {#each entries as entry (entry.name)}
        <li>
          <div class="flex justify-between items-center w-full hover:bg-base-300 rounded-lg gap-2">
            <!-- Left Side: Icon, Name, (Size for files) -->
            {#if entry.isDirectory}
              <button
                class="flex items-center flex-1 min-w-0 gap-3 text-left px-2 py-1 cursor-pointer"
                on:click={() => onOpenDirectory(entry.name)}
                title={entry.name}
              >
                <span class="text-xl text-info">📁</span>
                <span class="truncate flex-1">{entry.name}</span>
              </button>
            {:else}
              <div class="flex items-center flex-1 min-w-0 gap-3 cursor-pointer" title={entry.name}>
                 <span class="text-xl text-base-content text-opacity-80">📄</span>
                 <span class="truncate flex-1">{entry.name}</span>
                 {#if entry.size != null}
                   <span class="badge badge-sm badge-ghost flex-shrink-0">
                     {formatFileSize(entry.size)}
                   </span>
                 {/if}
              </div>
            {/if}

            <!-- Right Side: Action Buttons -->
            <div class="flex gap-1 flex-shrink-0">
              <button
                class="btn btn-xs btn-ghost text-warning hover:bg-warning hover:text-warning-content"
                on:click|stopPropagation={() => onRename(entry.name)}
                title="Rename {entry.name}"
              >
                ✏️
              </button>
              <button
                 class="btn btn-xs btn-ghost text-error hover:bg-error hover:text-error-content"
                 on:click|stopPropagation={() => onDelete(entry.name)}
                 title="Delete {entry.name}"
              >
                 🗑️
               </button>
            </div>
          </div>
        </li>
      {/each}
    </ul>
  {:else}
    <!-- Data Loaded - Truly Empty State -->
    <div class="h-full flex items-center justify-center text-center p-4">
      <p class="text-base-content text-opacity-60">
        This folder is empty.
      </p>
    </div>
  {/if}
</div>