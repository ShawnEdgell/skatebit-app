<!-- src/lib/features/modio/components/LocalMapList.svelte -->
<script lang="ts">
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
  import { get, writable } from 'svelte/store';
  import { modalStore, openModal } from "$lib/stores/modalStore"; // Import openModal
  import { normalizePath } from '$lib/ts/pathUtils';
  import { mapsFolder as mapsFolderStore } from "$lib/stores/mapsFolderStore";
  import { deleteEntry } from '$lib/ts/fsOperations';
  import { handleError, handleSuccess } from '$lib/ts/errorHandler';
  import { documentDir } from '@tauri-apps/api/path';

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
      const sizeA = a.size ?? 0;
      const sizeB = b.size ?? 0;
      return sizeB - sizeA;
    }
    return 0;
  });

  $: displayMaps = $localMapsSearchQuery.trim() ? $localMapsSearchResults : sortedMaps;
$: if (displayMaps) {
    console.log("[Component] Current displayMaps for rendering:", JSON.parse(JSON.stringify(displayMaps)));
    const hasMissingPaths = displayMaps.some(map => !map?.path);
    if (hasMissingPaths) {
        console.error("[Component] !!! ERROR !!! displayMaps contains items with missing paths!");
        console.warn("[Component] Items with missing paths:", displayMaps.filter(map => !map?.path));
    }
}


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

  const documentDirPathStore = writable<string | null>(null);

  async function handleRequestDelete(event: CustomEvent<{ path: string; name: string | null }>) {
    const pathToDelete = event.detail.path;
    const nameToDelete = event.detail.name ?? 'this item';

    if (!pathToDelete) {
        handleError("Cannot delete item: Path is missing.", "Delete Operation");
        return;
    }

    const docDir = get(documentDirPathStore);
    if (!docDir) {
        handleError("Cannot determine document directory.", "Delete Operation");
        return;
    }

    const normalizedDocDir = normalizePath(docDir);
    const normalizedPathToDelete = normalizePath(pathToDelete);

    if (!normalizedPathToDelete.startsWith(normalizedDocDir)) {
        handleError(`Path is outside the document directory: ${pathToDelete}`, "Delete Operation");
        return;
    }

    const relativePathToDelete = normalizedPathToDelete.substring(normalizedDocDir.length).replace(/^\//, '');
    const pathParts = relativePathToDelete.split('/');
    const itemName = pathParts.pop();
    const parentRelativePath = pathParts.join('/');


    if (itemName === undefined) {
         handleError(`Could not derive item name for deletion: ${pathToDelete}`, "Delete Operation");
         return;
    }

    openModal({
        title: "Confirm Deletion",
        message: `Are you sure you want to permanently delete "${nameToDelete}"?`,
        confirmOnly: true,
        onSave: async () => {
            try {
                await deleteEntry(parentRelativePath, itemName);
                handleSuccess(`"${nameToDelete}" deleted successfully.`, "Deletion");
                await refreshLocalMaps();
            } catch (error) {
                console.error("Deletion failed.");
            }
        },
    });
  }


  let storeSubscription: (() => void) | null = null;

  onMount(() => {
    async function initializeComponent() {
      documentDirPathStore.set(normalizePath(await documentDir()));

      storeSubscription = localMapsStore.subscribe(value => {
        localMaps = value;
      });

      if (!get(localMapsInitialized) && !get(isLoadingLocalMaps)) {
        await refreshLocalMaps();
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
    }

    initializeComponent();

    return () => {
      if (storeSubscription) {
        storeSubscription();
        storeSubscription = null;
      }
      observer?.disconnect();
      scrollContainer?.removeEventListener('pointercancel', handlePointerUp);
    };
  });
</script>

<div class="mb-4 flex flex-col md:flex-row items-center justify-between gap-4">
  <div class="flex items-center gap-2 flex-wrap">
    <h2 class="text-2xl mr-2 font-bold">Local Maps</h2>
    <button
      type="button"
      class="badge cursor-pointer transition-colors {currentSort === 'recent' ? 'badge-primary' : 'badge-outline hover:bg-base-content hover:text-base-100 hover:border-base-content'}"
      on:click={() => currentSort = 'recent'}
      disabled={$isLoadingLocalMaps}>
      Most Recent
    </button>
    <button
      type="button"
      class="badge cursor-pointer transition-colors {currentSort === 'alphabetical' ? 'badge-primary' : 'badge-outline hover:bg-base-content hover:text-base-100 hover:border-base-content'}"
      on:click={() => currentSort = 'alphabetical'}
      disabled={$isLoadingLocalMaps}>
      Alphabetical
    </button>
    <button
      type="button"
      class="badge cursor-pointer transition-colors {currentSort === 'size' ? 'badge-primary' : 'badge-outline hover:bg-base-content hover:text-base-100 hover:border-base-content'}"
      on:click={() => currentSort = 'size'}
      disabled={$isLoadingLocalMaps}>
      Size
    </button>
  </div>
  <input
    type="text"
    placeholder="Search local maps..."
    bind:value={$localMapsSearchQuery}
    class="input input-sm input-bordered w-full max-w-xs"
    disabled={$isLoadingLocalMaps}
  />
</div>

<div class="relative min-h-[10rem]">
  {#if $isLoadingLocalMaps && displayMaps.length === 0}
    <div class="absolute inset-0 flex items-center justify-center p-4 z-10">
       <span class="loading loading-spinner loading-lg"></span>
    </div>
  {:else if !$isLoadingLocalMaps && displayMaps.length === 0}
    <div class="h-51 flex items-center justify-center p-4">
      <p class="text-center text-base-content/60">
          {#if $localMapsSearchQuery.trim()}
              No maps found matching '{$localMapsSearchQuery}'.
          {:else}
              No local maps found.<br/> Try downloading some!
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
      on:pointerleave={handlePointerUp}
      >
      {#each displayMaps as map, i (map.path ?? map.name ?? i)}
        <LocalMapCard localMap={map} on:requestDelete={handleRequestDelete} />
      {/each}
      <div bind:this={sentinel} class="flex-shrink-0 w-[1px] h-full"></div>
    </div>
  {/if}
</div>