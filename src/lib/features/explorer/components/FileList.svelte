<script lang="ts">
  import type { FsEntry } from '$lib/ts/fsOperations';
  import { formatFileSize } from '$lib/utils/formatter';

  export let entries: FsEntry[] = [];
  export let loading: boolean = false;

  export let onOpenDirectory: (name: string) => void;
  export let onRename: (name: string) => void;
  export let onDelete: (name: string) => void;

  function safeName(entry: FsEntry | undefined | null): string {
    return entry?.name ?? '';
  }

  function isActionable(entry: FsEntry | undefined | null): boolean {
    return !!entry && entry.name !== null;
  }
</script>

<div class=" h-full">
  {#if loading}
    <div class="absolute inset-0 flex items-center justify-center z-10 bg-base-200/50">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  {/if}

  {#if !loading}
    {#if entries && entries.length > 0}
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
                      class="btn btn-xs btn-ghost text-warning hover:bg-warning hover:text-warning-content"
                      on:click|stopPropagation={() => onRename(safeName(entry))}
                    >✏️</button>
                    <button
                      class="btn btn-xs btn-ghost text-error hover:bg-error hover:text-error-content"
                      on:click|stopPropagation={() => onDelete(safeName(entry))}
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
    {/if}
  {/if}
</div>
