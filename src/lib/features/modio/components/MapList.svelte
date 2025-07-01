<script lang="ts">
  import { onDestroy, createEventDispatcher, afterUpdate } from 'svelte'
  import MapCard from './MapCard.svelte'
  import { draggable } from '$lib/actions/draggable'
  import type { Mod } from '$lib/types/modioTypes'

  export let mods: Mod[] = []
  export let visibleCount: number
  export let loading: boolean = false
  export let searchQuery: string = ''

  const dispatch = createEventDispatcher()
  let scrollContainer: HTMLElement
  let sentinel: HTMLElement
  let observer: IntersectionObserver
  let observerAttached = false

  function setupObserver() {
    observer?.disconnect()
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
    }
  }

  afterUpdate(() => {
    if (scrollContainer && sentinel && !observerAttached) {
      setupObserver()
    } else if (scrollContainer && !sentinel && observerAttached) {
      observer.disconnect()
      observerAttached = false
    }
  })

  onDestroy(() => {
    observer?.disconnect()
  })
</script>

<div class="relative">
  {#if loading && mods.length === 0}
    <div
      class="bg-base-100/50 absolute inset-0 z-10 flex items-center justify-center"
    >
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  {/if}

  {#if !loading && mods.length === 0}
    <div class="absolute inset-0 flex items-center justify-center p-4 h-36">
      <p class="text-base-content/60 text-center text-sm">
        {#if searchQuery.trim()}
          No maps matching “{searchQuery}”.
        {:else}
          No maps available from Mod.io.
        {/if}
      </p>
    </div>
  {:else}
    <div
      bind:this={scrollContainer}
      use:draggable
      class="scrollbar-thin flex h-full touch-pan-x flex-row gap-4 overflow-x-auto pb-2 select-none"
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
          <span class="text-base-content/50 text-xs whitespace-nowrap">
          </span>
        </div>
      {/if}
    </div>
  {/if}
</div>