<!-- src/lib/features/modio/components/MapList.svelte -->
<script lang="ts">
  import {
    onMount,
    onDestroy,
    createEventDispatcher,
    afterUpdate,
  } from 'svelte' // Add afterUpdate
  import MapCard from './MapCard.svelte'
  import type { Mod } from '$lib/types/modioTypes'
  import { draggable } from '$lib/actions/draggable'

  export let mods: Mod[] = []
  export let visibleCount: number
  export let loading: boolean = false // This prop indicates if *more* data is being fetched

  const dispatch = createEventDispatcher()
  let scrollContainer: HTMLElement | undefined = undefined
  let sentinel: HTMLElement | undefined = undefined
  let observer: IntersectionObserver | null = null
  let observerAttached = false

  // Function to setup or update the observer
  function setupObserver() {
    if (observer) {
      observer.disconnect() // Disconnect previous if exists
    }
    if (scrollContainer) {
      // Ensure scrollContainer exists
      observer = new IntersectionObserver(
        (entries) => {
          // Use the loading prop passed from parent to prevent multiple dispatches
          if (entries[0]?.isIntersecting && !loading) {
            console.log('MapList sentinel intersected, dispatching loadMore')
            dispatch('loadMore')
          }
        },
        // Set the root to the scroll container
        {
          root: scrollContainer,
          threshold: 0.1,
          rootMargin: '0px 0px 300px 0px',
        }, // Increased rootMargin
      )
      if (sentinel) {
        observer.observe(sentinel)
        observerAttached = true
        console.log('MapList observer attached.')
      } else {
        observerAttached = false // Sentinel not ready yet
      }
    } else {
      observer = null // Can't create observer without root
      observerAttached = false
    }
  }

  onMount(() => {
    // Observer will be set up in afterUpdate when elements are ready
    return () => {
      observer?.disconnect() // Cleanup on unmount
    }
  })

  afterUpdate(() => {
    // Setup observer after DOM updates ensure elements exist
    // Re-setup if scrollContainer appears/changes? (depends if needed)
    if (!observerAttached && scrollContainer && sentinel) {
      setupObserver()
    }
  })

  onDestroy(() => {
    observer?.disconnect() // Final cleanup
  })
</script>

<div
  bind:this={scrollContainer}
  use:draggable
  class="flex flex-row gap-4 pb-2 overflow-x-auto select-none touch-pan-x scrollbar-thin"
  role="list"
>
  {#each mods.slice(0, visibleCount) as mod (mod.id)}
    <MapCard {mod} />
  {/each}
  <!-- Sentinel is only useful if there might be more items -->
  {#if visibleCount < mods.length}
    <div
      bind:this={sentinel}
      class="flex-shrink-0 grid place-content-center p-4 min-w-[1px] h-full"
    >
      <!-- Optionally show a mini-spinner inside sentinel when loading prop is true -->
      {#if loading}
        <span class="loading loading-spinner loading-xs"></span>
      {/if}
    </div>
  {:else if !loading}
    <!-- Show end of list only if not loading and all items are visible -->
    <div
      class="flex-shrink-0 grid place-content-center p-4 min-w-[50px] h-full"
    >
      <span class="text-xs text-base-content/50 whitespace-nowrap"
        >End of list</span
      >
    </div>
  {/if}
</div>
