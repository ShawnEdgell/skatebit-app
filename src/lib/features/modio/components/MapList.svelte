<script lang="ts">
  import {
    onMount,
    onDestroy,
    createEventDispatcher,
    afterUpdate,
  } from 'svelte'
  import MapCard from './MapCard.svelte'
  import type { Mod } from '$lib/types/modioTypes'
  import { draggable } from '$lib/actions/draggable'

  export let mods: Mod[] = []
  export let visibleCount: number
  export let loading: boolean = false

  const dispatch = createEventDispatcher()
  let scrollContainer: HTMLElement | undefined = undefined
  let sentinel: HTMLElement | undefined = undefined
  let observer: IntersectionObserver | null = null
  let observerAttached = false

  function setupObserver() {
    observer?.disconnect()
    if (scrollContainer) {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting && !loading) {
            dispatch('loadMore')
          }
        },
        {
          root: scrollContainer,
          threshold: 0.1,
          rootMargin: '0px 0px 300px 0px',
        },
      )
      if (sentinel) {
        observer.observe(sentinel)
        observerAttached = true
      } else {
        observerAttached = false
      }
    } else {
      observer = null
      observerAttached = false
    }
  }

  afterUpdate(() => {
    if (scrollContainer && sentinel && !observerAttached) {
      setupObserver()
    } else if (scrollContainer && !sentinel && observerAttached) {
      observer?.disconnect()
      observerAttached = false
    }
  })

  onDestroy(() => {
    observer?.disconnect()
  })
</script>

<div
  bind:this={scrollContainer}
  use:draggable
  class="scrollbar-thin flex touch-pan-x flex-row gap-4 overflow-x-auto pb-2 select-none"
  role="list"
>
  {#each mods.slice(0, visibleCount) as mod (mod.id)}
    <MapCard {mod} />
  {/each}

  {#if visibleCount < mods.length}
    <div
      bind:this={sentinel}
      class="grid h-full min-w-[1px] flex-shrink-0 place-content-center p-4"
      aria-hidden="true"
    >
      {#if loading}
        <span class="loading loading-spinner loading-xs"></span>
      {/if}
    </div>
  {:else if !loading && mods.length > 0}
    <div
      class="grid h-full min-w-[50px] flex-shrink-0 place-content-center p-4"
    >
      <span class="text-base-content/50 text-xs whitespace-nowrap"
        >End of list</span
      >
    </div>
  {/if}
</div>
