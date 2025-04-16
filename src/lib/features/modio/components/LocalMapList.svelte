<!-- src/lib/features/modio/components/LocalMapList.svelte -->
<script lang="ts">
  import { onMount, createEventDispatcher, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import LocalMapCard from './LocalMapCard.svelte'; // Correct path assuming structure
  import type { FsEntry } from '$lib/types/fsTypes';
  import { localMaps, localMapsLoading, refreshLocalMaps } from '$lib/stores/mapsStore';
  import { localSearchQuery as localMapsSearchQuery, localSearchResults as localMapsSearchResults } from '$lib/stores/localSearchStore';
  import { openModal } from '$lib/stores/uiStore';
  import { deleteEntry } from '$lib/services/fileService';
  import { handleError, handleSuccess } from '$lib/utils/errorHandler';
  import { draggable } from '$lib/actions/draggable';

  const dispatch = createEventDispatcher();

  let scrollContainer: HTMLElement | undefined = undefined;

  type SortCriteria = 'recent' | 'alphabetical' | 'size';
  let currentSort: SortCriteria = 'recent';

  $: sortedMaps = [...$localMaps].sort((a, b) => {
    if (currentSort === 'alphabetical') {
      return (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' });
    } else if (currentSort === 'recent') {
      return (b.modified ?? 0) - (a.modified ?? 0);
    } else if (currentSort === 'size') {
      return (b.size ?? 0) - (a.size ?? 0);
    }
    return 0;
  });

  $: displayMaps = $localMapsSearchQuery.trim() ? $localMapsSearchResults : sortedMaps;

  async function handleRequestDelete(event: CustomEvent<{ path: string; name: string | null }>) {
    const absolutePathToDelete = event.detail.path;
    const nameToDelete = event.detail.name ?? 'this item';
    if (!absolutePathToDelete) {
      handleError("Cannot delete item: Path is missing.", "Delete Operation");
      return;
    }
    openModal({
      title: "Confirm Deletion",
      message: `Move "${nameToDelete}"? to Recycle Bin?`,
      confirmText: "Delete",
      cancelText: "Cancel",
      confirmOnly: false,
      confirmClass: "btn-error",
      onSave: async () => {
        try {
          await deleteEntry(absolutePathToDelete);
          handleSuccess(`"${nameToDelete}" deleted successfully.`, "Deletion");
          await refreshLocalMaps();
        } catch (error) {
          console.error(`Deletion failed for ${absolutePathToDelete}:`, error);
          handleError(error, `Deleting ${nameToDelete}`);
        }
      }
    });
  }

  onMount(() => {
    if (!$localMapsLoading && $localMaps.length === 0) {
       refreshLocalMaps();
    }
  });

  onDestroy(() => {
    // Cleanup if needed
  });
</script>

<div class="flex flex-col md:flex-row items-center justify-between mb-4">
  <div class="flex items-center gap-2 flex-wrap ">
    <h2 class="text-2xl mr-2 font-bold">Local Maps</h2>
    <button type="button"
      class="badge cursor-pointer transition-colors {currentSort === 'recent' ? 'badge-primary' : 'badge-outline hover:bg-base-content hover:text-base-100 hover:border-base-content'}"
      on:click={() => currentSort = 'recent'}
      disabled={$localMapsLoading || $localMaps.length === 0}>
      Most Recent
    </button>
    <button type="button"
      class="badge cursor-pointer transition-colors {currentSort === 'alphabetical' ? 'badge-primary' : 'badge-outline hover:bg-base-content hover:text-base-100 hover:border-base-content'}"
      on:click={() => currentSort = 'alphabetical'}
      disabled={$localMapsLoading || $localMaps.length === 0}>
      A-Z
    </button>
    <button type="button"
      class="badge cursor-pointer transition-colors {currentSort === 'size' ? 'badge-primary' : 'badge-outline hover:bg-base-content hover:text-base-100 hover:border-base-content'}"
      on:click={() => currentSort = 'size'}
      disabled={$localMapsLoading || $localMaps.length === 0}>
      Size
    </button>
  </div>
  <input type="text" placeholder="Search local maps..." bind:value={$localMapsSearchQuery} class="input input-sm input-bordered w-full max-w-xs" disabled={$localMapsLoading || $localMaps.length === 0} />
</div>

<div class="relative h-51">
  {#if $localMapsLoading && $localMaps.length === 0}
    <div class="absolute inset-0 flex items-center justify-center p-4 z-10">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  {:else if !$localMapsLoading && displayMaps.length === 0}
    <div class="h-full flex items-center justify-center p-4 min-h-[10rem]">
      <p class="text-center text-base-content/60 text-sm">
        {#if $localMapsSearchQuery.trim()}
          No maps found matching '{$localMapsSearchQuery}'.
        {:else}
          No local maps found. Check settings or scan for maps.
        {/if}
      </p>
    </div>
  {:else}
    <div
      bind:this={scrollContainer}
      use:draggable
      class="flex flex-row gap-4 overflow-x-auto pb-2 select-none touch-pan-x scrollbar-thin h-full cursor-grab"
      role="list">
      {#each displayMaps as map, i (map.path ?? map.name ?? i)}
        <!-- FIX: Pass the 'map' loop variable to the 'localMap' prop -->
        <LocalMapCard localMap={map} on:requestDelete={handleRequestDelete} />
      {/each}
    </div>
    {#if $localMapsLoading && $localMaps.length > 0}
      <div class="absolute inset-0 flex items-center justify-center text-center p-4 z-10 bg-base-200/50 rounded-box">
        <span class="loading loading-spinner loading-md"></span>
      </div>
    {/if}
  {/if}
</div>