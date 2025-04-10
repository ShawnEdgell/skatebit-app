<script lang="ts">
  import { MapList, SortBadges } from './components';
  import { modioStore, type SortOption } from '$lib/stores/modioStore';
  import { tick } from 'svelte';

  const {
    mods,
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
  <SortBadges
    {sortOptions}
    selectedSort={$selectedSort}
    loading={$isLoading}
    on:selectSort={handleSelectSort}
  />
  <div class="relative flex-grow overflow-hidden">
    {#if $mods.length > 0}
      <MapList mods={$mods} visibleCount={$visibleCount} loading={$isLoading} on:loadMore={loadMore} />
    {:else if $isLoading}
      <div class="grid place-content-center h-51">
        <span class="loading loading-spinner loading-lg"></span>
      </div>
    {:else}
      <p class="text-center py-10 text-base-content/80">No mod.io maps found.</p>
    {/if}
  </div>
</section>
