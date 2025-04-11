<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import LocalMapCard from './LocalMapCard.svelte';
  import type { LocalMapEntry } from '$lib/ts/fsOperations';
  import { localMapsStore, localMapsInitialized, refreshLocalMaps } from '$lib/stores/localMaps';
  import { localMapsSearchQuery, localMapsSearchResults } from '$lib/stores/localSearchStore';
  import { get } from 'svelte/store';
  import { modalStore } from "$lib/stores/modalStore";
  import { normalizePath } from '$lib/ts/pathUtils';
  import { baseFolder } from "$lib/ts/fsOperations";

  export let localMaps: LocalMapEntry[] = [];

  const dispatch = createEventDispatcher();
  let scrollContainer: HTMLElement;
  let sentinel: HTMLElement;
  let observer: IntersectionObserver;
  let isDragging = false;
  let startX = 0;
  let scrollLeft = 0;
  let loading: boolean = true; // Initially set loading to true

  // --- Sorting State ---
  type SortCriteria = 'recent' | 'alphabetical' | 'size';
  let currentSort: SortCriteria = 'recent';

  // --- Reactive Sorted List ---
  $: sortedMaps = [...localMaps].sort((a, b) => {
    if (currentSort === 'alphabetical') {
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    } else if (currentSort === 'recent') {
      return (b.modified ?? 0) - (a.modified ?? 0);
    } else if (currentSort === 'size') {
      const sizeA = a.isDirectory ? -1 : (a.size ?? 0);
      const sizeB = b.isDirectory ? -1 : (b.size ?? 0);
      return sizeB - sizeA;
    }
    return 0;
  });

  // --- Determine Displayed Maps ---
  // Use search results if a query exists; otherwise, use the sorted maps.
  $: displayMaps = $localMapsSearchQuery.trim() ? $localMapsSearchResults : sortedMaps;

  // --- Pointer Event Handlers for Drag Scrolling ---
  function handlePointerDown(e: PointerEvent) {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
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

  // Instead of directly deleting the local map, this handler triggers the modal.
  function handleRequestDelete(event: CustomEvent<{ name: string }>) {
  const nameToDelete = event.detail.name;
  modalStore.set({
    open: true,
    type: "crud",
    props: {
      action: "delete",
      currentPath: normalizePath(`${baseFolder}/Maps`),
      currentName: nameToDelete,
      onConfirm: async () => {
        // Perform deletion logic here, for example by updating the store.
        localMapsStore.update((maps) => maps.filter((map) => map.name !== nameToDelete));
      }
    }
  });
  } 

  onMount(() => {
    let unsubscribeMaps: () => void;

    async function initializeComponent() {
      if (!get(localMapsInitialized)) {
        loading = true;
        await refreshLocalMaps();
        loading = false;
      } else {
        loading = false;
      }
      unsubscribeMaps = localMapsStore.subscribe((value) => {
        localMaps = value;
      });

      observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting && !loading) {
            dispatch('loadMore');
          }
        },
        { root: scrollContainer, threshold: 0.1, rootMargin: '0px 0px 200px 0px' }
      );
      if (sentinel) observer.observe(sentinel);
      scrollContainer.addEventListener('pointercancel', handlePointerUp);
    }

    initializeComponent();

    return () => {
      if (unsubscribeMaps) {
        unsubscribeMaps();
      }
      observer?.disconnect();
      scrollContainer?.removeEventListener('pointercancel', handlePointerUp);
    };
  });

  onDestroy(() => {
    // Additional cleanup if necessary.
  });
</script>

<!-- Local Maps Header: Sorting Controls & Search Bar -->
<div class="mb-4 flex flex-col md:flex-row items-center justify-between gap-4">
  <div class="flex items-center gap-2 flex-wrap">
    <h2 class="text-2xl mr-2 font-bold">Local Maps</h2>
    <button
      type="button"
      class="badge cursor-pointer transition-colors {currentSort === 'recent' ? 'badge-primary' : 'badge-outline hover:bg-base-content hover:text-base-100 hover:border-base-content'}"
      on:click={() => currentSort = 'recent'}
      disabled={loading}>
      Recent
    </button>
    <button
      type="button"
      class="badge cursor-pointer transition-colors {currentSort === 'alphabetical' ? 'badge-primary' : 'badge-outline hover:bg-base-content hover:text-base-100 hover:border-base-content'}"
      on:click={() => currentSort = 'alphabetical'}
      disabled={loading}>
      Alphabetical
    </button>
    <button
      type="button"
      class="badge cursor-pointer transition-colors {currentSort === 'size' ? 'badge-primary' : 'badge-outline hover:bg-base-content hover:text-base-100 hover:border-base-content'}"
      on:click={() => currentSort = 'size'}
      disabled={loading}>
      Size
    </button>
  </div>
  <!-- Search Input for Local Maps -->
  <input
    type="text"
    placeholder="Search local maps by name..."
    bind:value={$localMapsSearchQuery}
    class="input input-sm w-full max-w-xs"
  />
</div>

<!-- Local Maps Display -->
<div class="relative">
  {#if !loading && displayMaps.length === 0}
    <!-- Render a full area container instead of inside the scroll container -->
    <div class="h-51 flex items-center justify-center p-4">
      <p class="text-xs text-base-content/50 whitespace-nowrap">No local maps found.</p>
    </div>
  {:else}
    <div
      bind:this={scrollContainer}
      class="flex flex-row gap-4 overflow-x-auto pb-2 select-none touch-none scrollbar-thin h-full"
      class:cursor-grabbing={isDragging}
      class:cursor-grab={!isDragging}
      role="list"
      on:pointerdown={handlePointerDown}
      on:pointermove={handlePointerMove}
      on:pointerup={handlePointerUp}
      style="cursor: grab;">
      {#each displayMaps as map, i (map.name + '-' + i)}
        <!-- Note: Listen for our custom event "requestDelete" -->
        <LocalMapCard localMap={map} on:requestDelete={handleRequestDelete} />
      {/each}
      <div bind:this={sentinel} class="flex-shrink-0 grid place-content-center p-4 min-w-[50px] h-full"></div>
    </div>
  {/if}
</div>
