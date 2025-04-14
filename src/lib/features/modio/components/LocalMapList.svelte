<!-- src/lib/features/modio/components/LocalMapList.svelte -->
<script lang="ts">
  // Script part is the same as the previous 'no comments' version...
  import { onMount, createEventDispatcher } from 'svelte';
  import LocalMapCard from './LocalMapCard.svelte';
  import type { FsEntry } from '$lib/ts/fsOperations';
  import {
      localMapsStore,
      localMapsInitialized,
      refreshLocalMaps,
      isLoadingLocalMaps
  } from '$lib/stores/localMapsStore';
  import { localMapsSearchQuery, localMapsSearchResults } from '$lib/stores/localMapsSearchStore';
  import { get } from 'svelte/store';
  import { openModal } from "$lib/stores/modalStore";
  import { deleteEntryFs } from '$lib/ts/fsOperations';
  import { handleError, handleSuccess } from '$lib/ts/errorHandler';

  export let localMaps: FsEntry[] = [];

  const dispatch = createEventDispatcher();
  let scrollContainer: HTMLElement;
  let sentinel: HTMLElement;
  let observer: IntersectionObserver;
  let isDragging = false;
  let startX = 0;
  let scrollLeft = 0;

  type SortCriteria = 'recent' | 'alphabetical' | 'size';
  let currentSort: SortCriteria = 'recent';

  $: sortedMaps = [...localMaps].sort((a, b) => {
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
    if ((e.target as HTMLElement).closest('button, a')) return;
    isDragging = true;
    const target = e.currentTarget as HTMLElement;
    target.style.cursor = 'grabbing';
    target.setPointerCapture(e.pointerId);
    startX = e.clientX - target.offsetLeft;
    scrollLeft = target.scrollLeft;
  }
  function handlePointerMove(e: PointerEvent) {
    if (!isDragging) return;
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    const x = e.clientX - target.offsetLeft;
    target.scrollLeft = scrollLeft - (x - startX) * 1.5;
  }
  function handlePointerUp(e: PointerEvent) {
    if (!isDragging) return;
    isDragging = false;
    const target = e.currentTarget as HTMLElement;
    target.style.cursor = 'grab';
    target.releasePointerCapture(e.pointerId);
  }

  async function handleRequestDelete(event: CustomEvent<{ path: string; name: string | null }>) {
    const absolutePathToDelete = event.detail.path;
    const nameToDelete = event.detail.name ?? 'this item';

    if (!absolutePathToDelete) {
        handleError("Cannot delete item: Path is missing.", "Delete Operation");
        return;
    }

    // This configuration ALREADY achieves what you want:
    openModal({
        title: "Confirm Deletion", // Title shown
        message: `Are you sure you want to permanently delete "${nameToDelete}"? This cannot be undone.`, // Message shown
        confirmText: "Delete",   // Text for the confirm button
        cancelText: "Cancel",    // Text for the cancel button
        confirmOnly: false,      // Ensures cancel button is shown (default is false anyway)
        confirmClass: "btn-error", // Styles the confirm button as error/red
        onSave: async () => {    // Action for the "Delete" (confirm) button
            try {
                await deleteEntryFs(absolutePathToDelete);
                handleSuccess(`"${nameToDelete}" deleted successfully.`, "Deletion");
                await refreshLocalMaps();
            } catch (error) {
                console.error(`Deletion failed for ${absolutePathToDelete} in component handler:`, error);
                handleError(error, `Deleting ${nameToDelete}`);
            }
        },
        // onCancel is optional if you just want it to close the modal
    });
  }

  let storeSubscription: (() => void) | null = null;

  onMount(() => {
    storeSubscription = localMapsStore.subscribe(value => {
      localMaps = value;
    });

    if (!get(localMapsInitialized) && !get(isLoadingLocalMaps)) {
      refreshLocalMaps();
    } else {
        localMaps = get(localMapsStore);
    }

    observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !get(isLoadingLocalMaps)) {
          dispatch('loadMore');
        }
      },
      { root: scrollContainer, threshold: 0.1, rootMargin: '0px 0px 200px 0px' }
    );
    if (sentinel && scrollContainer) observer.observe(sentinel);
    scrollContainer?.addEventListener('pointercancel', handlePointerUp);

    return () => {
      if (storeSubscription) storeSubscription();
      observer?.disconnect();
      scrollContainer?.removeEventListener('pointercancel', handlePointerUp);
    };
  });
</script>

<!-- Template -->
<div class="mb-4 flex flex-col md:flex-row items-center justify-between gap-4">
  <div class="flex items-center gap-2 flex-wrap">
    <h2 class="text-2xl mr-2 font-bold">Local Maps</h2>
    <button type="button" class="badge cursor-pointer transition-colors {currentSort === 'recent' ? 'badge-primary' : 'badge-outline hover:bg-base-content hover:text-base-100 hover:border-base-content'}" on:click={() => currentSort = 'recent'} disabled={$isLoadingLocalMaps}>Recent</button>
    <button type="button" class="badge cursor-pointer transition-colors {currentSort === 'alphabetical' ? 'badge-primary' : 'badge-outline hover:bg-base-content hover:text-base-100 hover:border-base-content'}" on:click={() => currentSort = 'alphabetical'} disabled={$isLoadingLocalMaps}>A-Z</button>
    <button type="button" class="badge cursor-pointer transition-colors {currentSort === 'size' ? 'badge-primary' : 'badge-outline hover:bg-base-content hover:text-base-100 hover:border-base-content'}" on:click={() => currentSort = 'size'} disabled={$isLoadingLocalMaps}>Size</button>
  </div>
  <input type="text" placeholder="Search local maps..." bind:value={$localMapsSearchQuery} class="input input-sm input-bordered w-full max-w-xs" disabled={$isLoadingLocalMaps} />
</div>

<div class="relative min-h-[10rem]">
  {#if $isLoadingLocalMaps && displayMaps.length === 0}
    <div class="absolute inset-0 flex items-center justify-center p-4 z-10">
       <span class="loading loading-spinner loading-lg"></span>
    </div>
  {:else if !$isLoadingLocalMaps && displayMaps.length === 0}
    <div class="h-full flex items-center justify-center p-4 min-h-[10rem]">
      <p class="text-center text-base-content/60">
          {#if $localMapsSearchQuery.trim()}
              No maps found matching '{$localMapsSearchQuery}'.
          {:else}
              No local maps found.
          {/if}
      </p>
    </div>
  {:else if displayMaps.length > 0}
    <div
      bind:this={scrollContainer}
      class="flex flex-row gap-4 overflow-x-auto pb-2 select-none touch-pan-x scrollbar-thin h-full {isDragging ? 'cursor-grabbing' : 'cursor-grab'}"
      role="list"
      on:pointerdown={handlePointerDown}
      on:pointermove={handlePointerMove}
      on:pointerup={handlePointerUp}
      on:pointerleave={handlePointerUp}
      >
      {#each displayMaps as map, i (map.path ?? map.name ?? i)}
        <LocalMapCard localMap={map} on:requestDelete={handleRequestDelete} />
      {/each}
      <div bind:this={sentinel} class="flex-shrink-0 w-[1px] h-full"></div>
    </div>
     {#if $isLoadingLocalMaps}
       <div class="absolute inset-0 flex items-center justify-center text-center p-4 z-10 bg-base-200/50 rounded-box">
            <span class="loading loading-spinner loading-md"></span>
        </div>
     {/if}
  {/if}
</div>