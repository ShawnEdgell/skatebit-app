<script lang="ts">
  import { MapList, SortBadges } from './components';
  import { modioStore, type SortOption } from '$lib/stores/modioStore';
  import { modSearchQuery, modSearchResults } from '$lib/stores/modSearchStore';
  import { tick } from 'svelte';

  const {
    visibleCount,
    selectedSort,
    isLoading,
    loadMore,
    sort
  } = modioStore;

  const sortOptions = [
    { label: 'Most Recent', value: 'recent' },
    { label: 'Popular', value: 'popular' },
    { label: 'Downloads', value: 'downloads' },
    { label: 'Rating', value: 'rating' }
  ];

  async function handleSelectSort(e: CustomEvent<string>) {
    const sortValue = e.detail as SortOption;
    sort(sortValue);
    await tick();
    document.querySelector('.flex.flex-row.gap-4.overflow-x-auto')?.scrollTo({ left: 0 });
  }
</script>

<section>
  <div class="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
    <SortBadges
      {sortOptions}
      selectedSort={$selectedSort}
      loading={$isLoading}
      on:selectSort={handleSelectSort}
    />
    <!-- Search input bound to the search query store -->
    <input
      type="text"
      placeholder="Search mods by name, summary, or tags..."
      bind:value={$modSearchQuery}
      class="input input-sm "
    />
  </div>
  
  <div class="h-51">
    <!-- Use the derived search results for the mod list -->
    {#if $modSearchResults.length > 0}
      <MapList mods={$modSearchResults} visibleCount={$visibleCount} loading={$isLoading} on:loadMore={loadMore} />
    {:else if $isLoading}
      <div class="flex items-center justify-center h-full">
        <span class="loading loading-spinner loading-lg mb-4"></span>
      </div>
    {:else}
    <div class="flex-shrink-0 grid place-content-center p-4 h-full">
      <p class="text-xs text-base-content/50 whitespace-nowrap">No mod.io maps found.</p>
    </div>
    {/if}
  </div>
</section>
