<script lang="ts">
  import ListToolbar from './components/ListToolbar.svelte'
  import MapList from './components/MapList.svelte'
  import LocalMapList from './components/LocalMapList.svelte'

  import { page } from '$app/stores'
  import { browser } from '$app/environment'
  import { onDestroy, tick } from 'svelte'

  import {
    modioSearchQuery,
    modioSearchResults,
    modioSortOrder,
  } from '$lib/stores/modioSearchStore'
  import { mapsDirectory } from '$lib/stores/globalPathsStore'
  import { activeDropTargetInfo } from '$lib/stores/dndStore'
  import {
    modioMapsLoading,
    localMaps,
    localMapsLoading,
  } from '$lib/stores/mapsStore'
  import { localSearchQuery } from '$lib/stores/localSearchStore'

  // — Types for sort values
  type ModioSortValue = 'recent' | 'popular' | 'downloads'
  type LocalSortValue = 'recent' | 'alphabetical' | 'size'

  // — Mod.io sort options
  const modioSortOptions: { label: string; value: ModioSortValue }[] = [
    { label: 'Most Recent', value: 'recent' },
    { label: 'Popular', value: 'popular' },
    { label: 'Downloads', value: 'downloads' },
  ]
  let modioVisibleCount = 10
  function selectModioSort(v: ModioSortValue) {
    if (v !== $modioSortOrder) {
      modioSortOrder.set(v)
      modioVisibleCount = 10
      tick().then(() => {
        document
          .querySelector('#modio-map-list-container .scrollbar-thin')
          ?.scrollTo({ left: 0, behavior: 'smooth' })
      })
    }
  }
  function handleModioLoadMore() {
    if (modioVisibleCount < $modioSearchResults.length) {
      modioVisibleCount += 10
    }
  }

  // — Local‑maps sort options
  const localSortOptions: { label: string; value: LocalSortValue }[] = [
    { label: 'Most Recent', value: 'recent' },
    { label: 'A‑Z', value: 'alphabetical' },
    { label: 'Size', value: 'size' },
  ]
  let localSortOrder: LocalSortValue = 'recent'
  function selectLocalSort(v: LocalSortValue) {
    localSortOrder = v
  }

  $: filteredLocalMaps = !$localSearchQuery.trim()
    ? $localMaps
    : $localMaps.filter((map) =>
        map.name
          ?.toLowerCase()
          .includes($localSearchQuery.trim().toLowerCase()),
      )

  // — register drop target on /modio
  $: if (browser && $page.url.pathname.startsWith('/modio')) {
    activeDropTargetInfo.set({ path: $mapsDirectory, label: 'Maps Folder' })
  }
  onDestroy(() => {
    activeDropTargetInfo.set({ path: null, label: null })
  })
</script>

<svelte:head>
  <title>Maps – XL Web Manager</title>
</svelte:head>

<main class="bg-base-300 mx-auto flex h-full w-full flex-col gap-4 px-4">
  <!-- Mod.io Maps Card -->
  <div class="bg-base-100 rounded-box flex flex-col gap-4 p-4 shadow-md">
    <ListToolbar
      title="Mod.io Maps"
      searchQuery={$modioSearchQuery}
      on:search={(e: CustomEvent<string>) => modioSearchQuery.set(e.detail)}
      sortOptions={modioSortOptions}
      sortOrder={$modioSortOrder}
      on:sort={(e: CustomEvent<string>) =>
        selectModioSort(e.detail as ModioSortValue)}
      disabled={$modioMapsLoading}
    />

    <div class="h-51 overflow-hidden" id="modio-map-list-container">
      <MapList
        mods={$modioSearchResults}
        loading={$modioMapsLoading}
        visibleCount={modioVisibleCount}
        on:loadMore={handleModioLoadMore}
      />
    </div>
  </div>

  <!-- Local Maps Card -->
  <div class="bg-base-100 rounded-box flex flex-col gap-4 p-4 shadow-md">
    <ListToolbar
      title="Local Maps"
      searchQuery={$localSearchQuery}
      on:search={(e: CustomEvent<string>) => localSearchQuery.set(e.detail)}
      sortOptions={localSortOptions}
      sortOrder={localSortOrder}
      on:sort={(e: CustomEvent<string>) =>
        selectLocalSort(e.detail as LocalSortValue)}
      disabled={$localMapsLoading || $localMaps.length === 0}
    />

    <div class="h-51 overflow-hidden">
      <LocalMapList
        maps={filteredLocalMaps}
        loading={$localMapsLoading}
        searchQuery={$localSearchQuery}
      />
    </div>
  </div>
</main>
