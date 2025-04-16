<script lang="ts">
  import { onMount, createEventDispatcher, onDestroy, afterUpdate } from 'svelte';
  import { get } from 'svelte/store';
  import LocalMapCard from './LocalMapCard.svelte';
  import type { FsEntry } from '$lib/types/fsTypes';
  import { localMaps, localMapsLoading, refreshLocalMaps } from '$lib/stores/mapsStore';
  import { localSearchQuery as localMapsSearchQuery, localSearchResults as localMapsSearchResults } from '$lib/stores/localSearchStore';
  import { openModal } from '$lib/stores/uiStore';
  import { deleteEntry } from '$lib/services/fileService';
  import { handleError, handleSuccess } from '$lib/utils/errorHandler';

  // Declare the prop
  export let localMapsProp: FsEntry[] = [];

  // If you want to keep the store for other logic, you can still do that.
  // For example, use localMapsProp in place of $localMaps if desired.
  
  const dispatch = createEventDispatcher();
  
  let scrollContainer: HTMLElement | undefined = undefined;
  let sentinel: HTMLElement | undefined = undefined;
  let observer: IntersectionObserver | null = null;
  let observerAttached = false;

  let isDragging = false;
  let startX = 0;
  let scrollLeft = 0;

  type SortCriteria = 'recent' | 'alphabetical' | 'size';
  let currentSort: SortCriteria = 'recent';

  // Use localMapsProp if you want to sort passed in maps:
  $: sortedMaps = [...localMapsProp].sort((a, b) => {
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

  function handlePointerDown(e: PointerEvent) {
    if ((e.target as HTMLElement).closest('button, a') || !scrollContainer) return;
    isDragging = true;
    scrollContainer.style.cursor = 'grabbing';
    scrollContainer.setPointerCapture(e.pointerId);
    startX = e.clientX - scrollContainer.offsetLeft;
    scrollLeft = scrollContainer.scrollLeft;
  }
  function handlePointerMove(e: PointerEvent) {
    if (!isDragging || !scrollContainer) return;
    e.preventDefault();
    const x = e.clientX - scrollContainer.offsetLeft;
    scrollContainer.scrollLeft = scrollLeft - (x - startX) * 1.5;
  }
  function handlePointerUp(e: PointerEvent) {
    if (!isDragging || !scrollContainer) return;
    isDragging = false;
    scrollContainer.style.cursor = 'grab';
    scrollContainer.releasePointerCapture(e.pointerId);
  }

  async function handleRequestDelete(event: CustomEvent<{ path: string; name: string | null }>) {
    const absolutePathToDelete = event.detail.path;
    const nameToDelete = event.detail.name ?? 'this item';
    if (!absolutePathToDelete) {
      handleError("Cannot delete item: Path is missing.", "Delete Operation");
      return;
    }
    openModal({
      title: "Confirm Deletion",
      message: `Are you sure you want to permanently delete "${nameToDelete}"? This cannot be undone.`,
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
    if (!get(localMapsLoading)) {
       refreshLocalMaps();
    }

    observer = new IntersectionObserver(
      (entries: IntersectionObserverEntry[]) => {
        if (entries[0]?.isIntersecting && !$localMapsLoading) {
          // dispatch('loadMore');
        }
      },
      { root: null, threshold: 0.1, rootMargin: '0px 0px 200px 0px' }
    );

    return () => {
      observer?.disconnect();
    };
  });

  afterUpdate(() => {
    if (scrollContainer && sentinel && observer && !observerAttached) {
      observer.observe(sentinel);
      scrollContainer.addEventListener('pointercancel', handlePointerUp);
      observerAttached = true;
    }
  });

  onDestroy(() => {
    observer?.disconnect();
    scrollContainer?.removeEventListener('pointercancel', handlePointerUp);
  });
</script>

<!-- Template -->
<div class="flex flex-col md:flex-row items-center justify-between mb-4">
  <div class="flex items-center gap-2 flex-wrap ">
    <h2 class="text-2xl mr-2 font-bold">Local Maps</h2>
    <button type="button"
      class="badge cursor-pointer transition-colors {currentSort === 'recent' ? 'badge-primary' : 'badge-outline hover:bg-base-content hover:text-base-100 hover:border-base-content'}"
      on:click={() => currentSort = 'recent'}
      disabled={$localMapsLoading}>
      Most Recent
    </button>
    <button type="button"
      class="badge cursor-pointer transition-colors {currentSort === 'alphabetical' ? 'badge-primary' : 'badge-outline hover:bg-base-content hover:text-base-100 hover:border-base-content'}"
      on:click={() => currentSort = 'alphabetical'}
      disabled={$localMapsLoading}>
      A-Z
    </button>
    <button type="button"
      class="badge cursor-pointer transition-colors {currentSort === 'size' ? 'badge-primary' : 'badge-outline hover:bg-base-content hover:text-base-100 hover:border-base-content'}"
      on:click={() => currentSort = 'size'}
      disabled={$localMapsLoading}>
      Size
    </button>
  </div>
  <input type="text" placeholder="Search local maps..." bind:value={$localMapsSearchQuery} class="input input-sm input-bordered w-full max-w-xs" disabled={$localMapsLoading} />
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
          No local maps found.
        {/if}
      </p>
    </div>
  {:else}
    <div
      bind:this={scrollContainer}
      class="flex flex-row gap-4 overflow-x-auto pb-2 select-none touch-pan-x scrollbar-thin h-full {isDragging ? 'cursor-grabbing' : 'cursor-grab'}"
      role="list"
      on:pointerdown={handlePointerDown}
      on:pointermove={handlePointerMove}
      on:pointerup={handlePointerUp}
      on:pointerleave={handlePointerUp}>
      {#each displayMaps as map, i (map.path ?? map.name ?? i)}
        <LocalMapCard localMap={map} on:requestDelete={handleRequestDelete} />
      {/each}
      <div bind:this={sentinel} class="flex-shrink-0 w-[1px] h-full"></div>
    </div>
    {#if $localMapsLoading && $localMaps.length > 0}
      <div class="absolute inset-0 flex items-center justify-center text-center p-4 z-10 bg-base-200/50 rounded-box">
        <span class="loading loading-spinner loading-md"></span>
      </div>
    {/if}
  {/if}
</div>
