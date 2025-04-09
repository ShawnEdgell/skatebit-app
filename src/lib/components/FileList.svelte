<script lang="ts">
  import PathHeader from "./PathHeader.svelte";
  // Assuming you have these props and functions defined in your component script
  export let entries: Array<{ name: string; isDirectory: boolean; size?: number; modifiedAt?: Date | number | null }> = [];
  export let onOpenDirectory: (name: string) => void;
  export let onRename: (name: string) => void;
  export let onDelete: (name: string) => void;

  // Example formatter function (replace with your actual implementation)
  function formatFileSize(bytes: number | undefined): string {
    if (bytes === undefined || isNaN(bytes)) return '';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
</script>

<!-- Container: Scrollable, fixed height, background, padding -->
<div class="overflow-y-auto h-96 bg-base-200 w-full p-2 rounded-box">
  {#if entries.length > 0}
    <!-- Daisy UI : Takes full width within the padded container -->
    <ul class=" w-full p-0">
      {#each entries as entry (entry.name)}
        <!--  Item -->
        <li>
          <!--
            We use a div here instead of the typical <a> inside <li> for 
            to accommodate the complex layout with action buttons.
            We mimic  item styling with padding, hover, and rounded corners.
          -->
          <div class="flex justify-between items-center w-full hover:bg-base-300 rounded-lg px-2 py-1 gap-2">

            <!-- Left Side: Icon, Name, (Size for files) -->
            {#if entry.isDirectory}
              <!-- Directory: Make the clickable area flexible -->
              <button
                class="flex items-center flex-1 min-w-0 gap-3 text-left"
                on:click={() => onOpenDirectory(entry.name)}
                title={entry.name}
              >
                <span class="text-xl text-info">📁</span> 
                <span class="truncate flex-1">{entry.name}</span> 
              </button>
            {:else}
              <!-- File: Display info, not directly clickable here -->
              <div class="flex items-center flex-1 min-w-0 gap-3" title={entry.name}>
                 <span class="text-xl text-base-content text-opacity-80">📄</span>
                 <span class="truncate flex-1">{entry.name}</span> 
                 {#if entry.size != null}
                   <!-- File Size: Using a subtle badge -->
                   <span class="badge badge-sm badge-ghost flex-shrink-0">
                     {formatFileSize(entry.size)}
                   </span>
                 {/if}
              </div>
            {/if}

            <!-- Right Side: Action Buttons -->
            <div class="flex gap-1 flex-shrink-0">
               <!-- Using btn-ghost for less visual clutter until hover -->
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
    <!-- Empty State: Centered message -->
    <div class="h-full flex items-center justify-center text-center p-4">
      <p class="text-base-content text-opacity-60">
        This folder is empty.
      </p>
    </div>
  {/if}
</div>