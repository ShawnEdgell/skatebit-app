<!-- src/lib/components/LocalMapList.svelte -->
<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import LocalMapCard from './LocalMapCard.svelte';
  import type { DirEntry } from '@tauri-apps/plugin-fs';
  
  export let localMaps: DirEntry[] = [];
  export let loading: boolean = false;
  
  const dispatch = createEventDispatcher();
  let scrollContainer: HTMLElement;
  let sentinel: HTMLElement;
  let observer: IntersectionObserver;
  let isDragging = false;
  let startX = 0;
  let scrollLeft = 0;

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
  
  function handleDeleted(event: CustomEvent) {
    const name = event.detail.name;
    localMaps = localMaps.filter(map => map.name !== name);
  }

  onMount(() => {
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
  });

  onDestroy(() => {
    observer?.disconnect();
    scrollContainer?.removeEventListener('pointercancel', handlePointerUp);
  });
</script>

<div
  bind:this={scrollContainer}
  class="flex flex-row gap-4 overflow-x-auto pb-2 select-none touch-none scrollbar-thin h-full"
  class:cursor-grabbing={isDragging}
  class:cursor-grab={!isDragging}
  role="list"
  on:pointerdown={handlePointerDown}
  on:pointermove={handlePointerMove}
  on:pointerup={handlePointerUp}
>
  {#each localMaps as map, i (map.name + '-' + i)}
    <LocalMapCard localMap={map} on:deleted={handleDeleted} />
  {/each}
  <div bind:this={sentinel} class="flex-shrink-0 grid place-content-center p-4 min-w-[50px] h-full">
    {#if !loading && localMaps.length === 0}
      <span class="text-xs text-base-content/50 whitespace-nowrap">No local maps found.</span>
    {/if}
  </div>
</div>

{#if loading}
  <div class="absolute inset-0 flex items-center justify-center bg-base-200 bg-opacity-50 z-50">
    <span class="loading loading-spinner loading-lg"></span>
  </div>
{/if}
