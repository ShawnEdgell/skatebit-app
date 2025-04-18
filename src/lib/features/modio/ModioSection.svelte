<!-- src/lib/features/modio/ModioSection.svelte -->
<script lang="ts">
  import MapList from './components/MapList.svelte'
  import SortBadges from './components/SortBadges.svelte'
  // Import from the dedicated modio search/sort stores
  import {
    modioSearchQuery,
    modioSearchResults,
    modioSortOrder,
  } from '$lib/stores/modioSearchStore'
  // Import the correct loading store
  import { modioMapsLoading } from '$lib/stores/mapsStore'
  import { tick } from 'svelte'

  // Initial number of items to display
  let visibleCount = 10 // Start with a reasonable number

  // Define sort options (can remain local)
  const sortOptions = [
    { label: 'Most Recent', value: 'recent' },
    { label: 'Popular', value: 'popular' },
    { label: 'Downloads', value: 'downloads' },
  ]

  // Handler for sort selection - updates the STORE
  async function handleSelectSort(e: CustomEvent<string>) {
    const newSort = e.detail as 'recent' | 'popular' | 'downloads'
    modioSortOrder.set(newSort) // Update the central store
    visibleCount = 10 // Reset visible count on sort change
    await tick() // Wait for DOM updates
    // Attempt to find the specific scroll container for THIS section
    const scrollContainer = document.querySelector(
      '#modio-map-list-container .scrollbar-thin',
    ) // Add an ID to the MapList container div
    scrollContainer?.scrollTo({ left: 0, behavior: 'smooth' })
  }

  // Handler for loading more items
  function handleLoadMore() {
    // Only increase if there are more items to show
    if (visibleCount < $modioSearchResults.length) {
      console.log(
        `Loading more mods... Current: ${visibleCount}, Total: ${$modioSearchResults.length}`,
      )
      visibleCount += 10 // Increase the count (adjust increment as needed)
    } else {
      console.log('Load more called, but all mods are visible.')
    }
  }

  // No need for local 'isLoading' or 'selectedSort' - use stores directly
</script>

<section>
  <div class="mb-4 flex flex-col md:flex-row items-center justify-between">
    <!-- Pass store values directly to SortBadges -->
    <SortBadges
      {sortOptions}
      selectedSort={$modioSortOrder}
      loading={$modioMapsLoading}
      on:selectSort={handleSelectSort}
    />
    <!-- Bind search input to the modioSearchQuery store -->
    <input
      type="text"
      placeholder="Search mod.io maps..."
      bind:value={$modioSearchQuery}
      class="input input-sm input-bordered w-full mt-2 md:mt-0 md:max-w-xs"
      disabled={$modioMapsLoading}
    />
  </div>

  <!-- Give the container an ID for easier selection in handleSelectSort -->
  <div class="h-51" id="modio-map-list-container">
    {#if $modioMapsLoading && $modioSearchResults.length === 0}
      <!-- Show main spinner only on initial load when list is empty -->
      <div class="flex items-center justify-center h-full">
        <span class="loading loading-spinner loading-lg mb-4"></span>
      </div>
    {:else if !$modioMapsLoading && $modioSearchResults.length === 0}
      <!-- No results found (after loading) -->
      <div class="flex-shrink-0 grid place-content-center p-4 h-full">
        <p class="text-sm text-base-content/60 whitespace-nowrap">
          {#if $modioSearchQuery.trim()}
            No mod.io maps found matching '{$modioSearchQuery}'.
          {:else}
            No mod.io maps found.
          {/if}
        </p>
      </div>
    {:else}
      <!-- Pass store results, visibleCount, loading state, and loadMore handler -->
      <MapList
        mods={$modioSearchResults}
        {visibleCount}
        loading={$modioMapsLoading}
        on:loadMore={handleLoadMore}
      />
    {/if}
  </div>
</section>
