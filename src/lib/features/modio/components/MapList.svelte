<!-- Example in MapList.svelte -->
<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import MapCard from './MapCard.svelte';
  import type { Mod } from '$lib/types/modio';
  import { draggable } from '$lib/actions/draggable';

  export let mods: Mod[] = [];
  export let visibleCount: number;
  export let loading: boolean = false;

  const dispatch = createEventDispatcher();

  let scrollContainer: HTMLElement;
  let sentinel: HTMLElement;
  let observer: IntersectionObserver;

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
  });

  onDestroy(() => {
    observer?.disconnect();
  });
</script>

<div
  bind:this={scrollContainer}
  use:draggable
  class="flex flex-row gap-4 overflow-x-auto pb-2 select-none touch-none scrollbar-thin h-full"
  role="list"
>
  {#each mods.slice(0, visibleCount) as mod (mod.id)}
    <MapCard {mod} />
  {/each}
  <div bind:this={sentinel} class="flex-shrink-0 grid place-content-center p-4 min-w-[50px] h-full">
    {#if !loading && visibleCount >= mods.length}
      <span class="text-xs text-base-content/50 whitespace-nowrap">End of list</span>
    {/if}
  </div>
</div>

{#if loading}
  <div class="absolute inset-0 flex items-center justify-center bg-base-100/80 bg-opacity-50 z-50">
    <span class="loading loading-spinner loading-lg"></span>
  </div>
{/if}