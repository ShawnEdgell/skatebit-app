<!-- src/lib/features/modio/ModioLayout.svelte -->
<script lang="ts">
  import MapList from './components/MapList.svelte'
  import LocalMapList from './components/LocalMapList.svelte'
  import ListToolbar from './components/ListToolBar.svelte'

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
    modioMaps,
    modioMapsLoading,
    modioMapsError,
    refreshModioMaps,
    localMaps,
    localMapsLoading,
  } from '$lib/stores/mapsStore'
  import { localSearchQuery } from '$lib/stores/localSearchStore'

  type ModioSortValue = 'recent' | 'popular' | 'downloads'
  type LocalSortValue = 'recent' | 'alphabetical' | 'size'

  const modioSortOptions: { label: string; value: ModioSortValue }[] = [
    { label: 'Most Recent', value: 'recent' },
    { label: 'Popular', value: 'popular' },
    { label: 'Downloads', value: 'downloads' },
  ]

  let modioVisibleCount = 10
  function selectModioSort(detail: string) {
    const v = detail as ModioSortValue
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

  const localSortOptions: { label: string; value: LocalSortValue }[] = [
    { label: 'Most Recent', value: 'recent' },
    { label: 'A‑Z', value: 'alphabetical' },
    { label: 'Size', value: 'size' },
  ]

  let localSortOrder: LocalSortValue = 'recent'
  function selectLocalSort(detail: string) {
    localSortOrder = detail as LocalSortValue
  }

  $: filteredLocalMaps = !$localSearchQuery.trim()
    ? $localMaps
    : $localMaps.filter((m) =>
        m.name?.toLowerCase().includes($localSearchQuery.trim().toLowerCase()),
      )

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
  <!-- Mod.io Maps -->
  <div class="bg-base-100 rounded-box flex flex-col gap-4 p-4 shadow-md">
    <ListToolbar
      title="Mod.io Maps"
      searchQuery={$modioSearchQuery}
      on:search={(e) => modioSearchQuery.set(e.detail)}
      sortOptions={modioSortOptions}
      sortOrder={$modioSortOrder}
      on:sort={(e) => selectModioSort(e.detail)}
      disabled={$modioMapsLoading}
    />
    <MapList
      mods={$modioSearchResults}
      loading={$modioMapsLoading}
      visibleCount={modioVisibleCount}
      on:loadMore={handleModioLoadMore}
    />
  </div>

  <!-- Local Maps -->
  <div class="bg-base-100 rounded-box flex flex-col gap-4 p-4 shadow-md">
    <ListToolbar
      title="Local Maps"
      searchQuery={$localSearchQuery}
      on:search={(e) => localSearchQuery.set(e.detail)}
      sortOptions={localSortOptions}
      sortOrder={localSortOrder}
      on:sort={(e) => selectLocalSort(e.detail)}
      disabled={$localMapsLoading || $localMaps.length === 0}
    />
    <LocalMapList
      maps={filteredLocalMaps}
      loading={$localMapsLoading}
      searchQuery={$localSearchQuery}
    />
  </div>
</main>
