<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import LocalMapCard from './LocalMapCard.svelte';
  import type { LocalMapEntry } from '$lib/ts/fsOperations';
  import { localMapsStore, localMapsInitialized, refreshLocalMaps } from '$lib/stores/localMaps';
  import { get } from 'svelte/store';

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
  function handleDeleted(event: CustomEvent<{ name: string }>) {
    const nameToDelete = event.detail.name;
    localMaps = localMaps.filter((map) => map.name !== nameToDelete);
  }

   onMount(() => {
    let unsubscribeMaps: () => void;

    async function initializeComponent() {
      // Initially refresh the local maps if they haven't been loaded yet
      if (!get(localMapsInitialized)) {
        loading = true;
        await refreshLocalMaps();
        loading = false;
      } else {
        loading = false; // If already initialized, no need to show initial loading
      }

      // Subscribe to the localMapsStore to update the component's local maps
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

    initializeComponent(); // Call the async function

    return () => {
      if (unsubscribeMaps) {
        unsubscribeMaps();
      }
      observer?.disconnect();
      scrollContainer?.removeEventListener('pointercancel', handlePointerUp);
    };
  });

  onDestroy(() => {
    // Any cleanup from initializeLocalMapsWatcher if needed
  });
</script>

<div class="mb-4 flex items-center gap-2 flex-wrap">
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

<div class="relative">
  <div bind:this={scrollContainer}
       class="flex flex-row gap-4 overflow-x-auto pb-2 select-none touch-none scrollbar-thin h-full"
       class:cursor-grabbing={isDragging}
       class:cursor-grab={!isDragging}
       role="list"
       on:pointerdown={handlePointerDown}
       on:pointermove={handlePointerMove}
       on:pointerup={handlePointerUp}
       style="cursor: grab;">
    {#each sortedMaps as map, i (map.name + '-' + i)}
      <LocalMapCard localMap={map} on:deleted={handleDeleted} />
    {/each}
    <div bind:this={sentinel} class="flex-shrink-0 grid place-content-center p-4 min-w-[50px] h-full">
      {#if !loading && localMaps.length === 0}
        <span class="text-xs text-base-content/50 whitespace-nowrap">No local maps found.</span>
      {/if}
    </div>
  </div>
</div>