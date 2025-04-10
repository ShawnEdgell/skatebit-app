<script lang="ts">
  import { onMount, tick } from 'svelte';
  import SortBadges from '$lib/components/SortBadges.svelte';
  import MapList from '$lib/components/MapList.svelte';
  import LocalMapList from '$lib/components/LocalMapList.svelte';
  import DropZone from '$lib/components/DropZone.svelte';
  
  // Mod.io maps (unchanged)
  import type { Mod } from '$lib/types/modio';
  import { DISPLAY_PAGE_SIZE, FIRESTORE_PAGE_SIZE_ESTIMATE } from '$lib/api/constants';
  import { fetchModsPage, fetchAllMods, sortMods } from '$lib/ts/modApi';
  import { handleError } from '$lib/ts/errorHandler';
  
  // Local maps store and refresh function.
  import { localMapsStore, refreshLocalMaps } from '$lib/stores/localMaps';
  
  // --- Mod.io maps state ---
  const sortOptions = [
    { label: 'Most Recent', value: 'recent' },
    { label: 'Popular', value: 'popular' },
    { label: 'Downloads', value: 'downloads' },
    { label: 'Rating', value: 'rating' }
  ];
  let selectedSort = "recent";
  let mods: Mod[] = [];
  let visibleCount = DISPLAY_PAGE_SIZE;
  let loading = false;
  let hasMoreToLoadFromSource = true;
  let isFullyLoaded = false;
  
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
      // Apply mod.io sorting as before
      mods = sortMods(mods, selectedSort);
    }
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
      mods = sortMods(mods, selectedSort);
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
  
  // --- Local maps state ---
  // Here we subscribe directly to your local maps store (no local sorting).
  $: localMaps = $localMapsStore;
  // (Optional loading flag for local maps – if needed, otherwise leave it false)
  let localMapsLoading = false;
  
  onMount(() => {
    loadAllMods();
    refreshLocalMaps();
  });
</script>

<DropZone />

<main class="mx-auto w-full flex flex-col space-y-6">
  <!-- Mod.io Maps Section -->
  <section>
    <SortBadges {sortOptions} {selectedSort} {loading} on:selectSort={handleSelectSort} />
    <div class="relative flex-grow overflow-hidden">
      {#if mods.length > 0}
        <MapList {mods} {visibleCount} {loading} on:loadMore={loadMore} />
      {:else if loading}
        <div class="grid place-content-center h-51">
          <span class="loading loading-spinner loading-lg"></span>
        </div>
      {:else}
        <p class="text-center py-10 text-base-content/80">No mod.io maps found.</p>
      {/if}
    </div>
  </section>
  
  <!-- Local Maps Section (without extra sorting) -->
  <section>
    <h2 class="text-2xl font-bold mb-4">Local Maps</h2>
    {#if localMapsLoading}
      <div class="grid place-content-center h-51">
        <span class="loading loading-spinner loading-lg"></span>
      </div>
    {:else}
      <!-- Pass the raw localMaps array to the LocalMapList component -->
      <LocalMapList localMaps={localMaps} loading={localMapsLoading} />
    {/if}
  </section>
</main>
