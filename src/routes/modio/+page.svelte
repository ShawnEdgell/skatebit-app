<script lang="ts">
  import { onMount, tick } from 'svelte';
  import SortBadges from '$lib/components/SortBadges.svelte';
  import MapList from '$lib/components/MapList.svelte';
  import LocalMapList from '$lib/components/LocalMapList.svelte';
  import type { Mod } from '$lib/types/modio';
  import { DISPLAY_PAGE_SIZE, FIRESTORE_PAGE_SIZE_ESTIMATE } from '$lib/api/constants';
  import { fetchModsPage, fetchAllMods, sortMods } from '$lib/ts/modApi';
  import { handleError } from '$lib/ts/errorHandler';
  import DropZone from '$lib/components/DropZone.svelte';
  import { localMapsStore, refreshLocalMaps } from '$lib/stores/localMaps';

  const sortOptions = [
    { label: 'Most Recent', value: 'recent' },
    { label: 'Popular', value: 'popular' },
    { label: 'Downloads', value: 'downloads' },
    { label: 'Rating', value: 'rating' }
  ];

  let selectedSort = sortOptions[0].value;
  let mods: Mod[] = [];
  let visibleCount = DISPLAY_PAGE_SIZE;
  let loading = false;
  let hasMoreToLoadFromSource = true;
  let isFullyLoaded = false;

  // Instead of a local variable for local maps, we can derive it from our store.
  // If you need to, you can do either:
  // Option A: Use the $store auto-subscription.
  // Option B: Subscribe manually.
  // Here, we'll use Option A:
  $: localMaps = $localMapsStore; // $localMapsStore comes from our writable store.
  let localMapsLoading = false;

  async function loadAllMods() {
    loading = true;
    try {
      mods = await fetchAllMods();
      isFullyLoaded = true;
    } catch (e) {
      handleError(e, "loadAllMods");
      mods = [];
    } finally {
      loading = false;
      applySort();
    }
  }

  function applySort() {
    if (mods.length === 0) return;
    mods = sortMods(mods, selectedSort);
  }

  async function loadMore() {
    if (loading) return;
    if (isFullyLoaded) {
      if (visibleCount < mods.length) {
        visibleCount += DISPLAY_PAGE_SIZE;
      }
      return;
    }
    if (hasMoreToLoadFromSource) {
      loading = true;
      const nextPage = Math.ceil(mods.length / FIRESTORE_PAGE_SIZE_ESTIMATE) + 1;
      try {
        const newMods = await fetchModsPage(nextPage);
        if (newMods.length > 0) {
          const currentIds = new Set(mods.map(m => m.id));
          const uniqueNewMods = newMods.filter(nm => !currentIds.has(nm.id));
          if (uniqueNewMods.length > 0) {
            mods = [...mods, ...uniqueNewMods];
          }
        }
        visibleCount += DISPLAY_PAGE_SIZE;
      } catch (error) {
        handleError(error, "loadMore");
      } finally {
        loading = false;
      }
    } else {
      if (visibleCount < mods.length) {
        visibleCount += DISPLAY_PAGE_SIZE;
      }
    }
  }

  async function handleSelectSort(e: CustomEvent<string>) {
    const sortValue = e.detail;
    if (selectedSort === sortValue || loading) return;
    loading = true;
    selectedSort = sortValue;
    try {
      mods = await fetchAllMods();
      isFullyLoaded = true;
      hasMoreToLoadFromSource = false;
      applySort();
      visibleCount = DISPLAY_PAGE_SIZE;
      await tick();
      const scrollContainer: HTMLElement | null = document.querySelector('.flex.flex-row.gap-4.overflow-x-auto');
      scrollContainer?.scrollTo({ left: 0, behavior: 'auto' });
    } catch (error) {
      handleError(error, "handleSelectSort");
    } finally {
      loading = false;
    }
  }

  // Instead of calling loadLocalMaps() directly and assigning to a local variable,
  // we now simply refresh the store.
  onMount(() => {
    loadAllMods();
    refreshLocalMaps();
  });
</script>

<DropZone />
 
<main class="mx-auto w-full flex flex-col space-y-6">
  <!-- Mod.io maps section -->
  <section>
    <SortBadges {sortOptions} {selectedSort} {loading} on:selectSort={handleSelectSort} />
    <div class="relative flex-grow overflow-hidden">
      {#if mods.length > 0}
        <MapList {mods} {visibleCount} {loading} on:loadMore={loadMore} />
      {:else if loading}
        <div class="grid place-content-center h-51 bg-base-200">
          <span class="loading loading-spinner loading-lg"></span>
        </div>
      {:else}
        <p class="text-center py-10 text-base-content/80">No mod.io maps found.</p>
      {/if}
    </div>
  </section>
  
  <!-- Local maps section -->
  <section>
    <h2 class="text-2xl font-bold mb-4">Local Maps</h2>
    {#if localMapsLoading}
      <div class="grid place-content-center h-51 bg-base-200">
        <span class="loading loading-spinner loading-lg"></span>
      </div>
    {:else}
      <LocalMapList {localMaps} loading={localMapsLoading} />
    {/if}
  </section>
</main>
