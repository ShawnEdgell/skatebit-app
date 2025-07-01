<script lang="ts">
  import MapList from './components/MapList.svelte'
  import LocalMapList from './components/LocalMapList.svelte'
  import ListToolbar from '$lib/components/ListToolBar.svelte'
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
    refreshModioMaps,
    localMaps,
    localMapsLoading,
  } from '$lib/stores/mapsStore'
  import { localSearchQuery } from '$lib/stores/localSearchStore'
  import type { Mod } from '$lib/types/modioTypes'
  import type { FsEntry } from '$lib/types/fsTypes'

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
          ?.scrollTo({ top: 0, behavior: 'smooth' })
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

  $: sortedAndFilteredLocalMaps = (() => {
    const mapsToSort: FsEntry[] = Array.isArray($localMaps) ? $localMaps : []
    const filtered = !$localSearchQuery.trim()
      ? mapsToSort
      : mapsToSort.filter((m) =>
          m.name?.toLowerCase().includes($localSearchQuery.trim().toLowerCase()),
        )
    const sorted = [...filtered]
    switch (localSortOrder) {
      case 'alphabetical':
        sorted.sort(
          (a, b) => a.name?.toLowerCase().localeCompare(b.name?.toLowerCase() ?? '') ?? 0,
        )
        break
      case 'size':
        sorted.sort((a, b) => (b.size ?? -1) - (a.size ?? -1))
        break
      case 'recent':
      default:
        sorted.sort((a, b) => (b.modified ?? 0) - (a.modified ?? 0))
        break
    }
    return sorted
  })()

  $: if (browser && ($page.url.pathname === '/' || $page.url.pathname.startsWith('/modio'))) {
    activeDropTargetInfo.set({ path: $mapsDirectory, label: 'Maps Folder' })
  } else if (browser) {
    activeDropTargetInfo.set({ path: null, label: null })
  }

  onDestroy(() => {
    activeDropTargetInfo.set({ path: null, label: null })
  })
</script>

<svelte:head><title>Maps – XL Web Manager</title></svelte:head>

<main class="bg-base-300 mx-auto flex h-full w-full flex-col gap-4 px-4 ">
  <div class="bg-base-100 rounded-box flex flex-col gap-4 p-4 shadow-md">
    <ListToolbar
      title="Mod.io Maps"
      searchQuery={$modioSearchQuery}
      on:search={(e) => modioSearchQuery.set(e.detail)}
      sortOptions={modioSortOptions}
      sortOrder={$modioSortOrder}
      on:sort={(e) => selectModioSort(e.detail)}
      disabled={$modioMapsLoading}
      on:refresh={refreshModioMaps}
    />
  <div id="modio-map-list-container" class="min-h-0 flex-1">
    <MapList
      mods={$modioSearchResults}
      loading={$modioMapsLoading}
      visibleCount={modioVisibleCount}
      searchQuery={$modioSearchQuery}
      on:loadMore={handleModioLoadMore}
    />
  </div>
  </div>

  <div class="bg-base-100 rounded-box flex flex-col gap-4 p-4 shadow-md">
    <ListToolbar
      title="Local Maps"
      searchQuery={$localSearchQuery}
      on:search={(e) => localSearchQuery.set(e.detail)}
      sortOptions={localSortOptions}
      sortOrder={localSortOrder}
      on:sort={(e) => selectLocalSort(e.detail)}
      disabled={$localMapsLoading || $localMaps.length === 0}
      on:refresh={() => {}}
    />
    <div class="min-h-0 flex-1">
      <LocalMapList maps={sortedAndFilteredLocalMaps} searchQuery={$localSearchQuery} />
    </div>
  </div>
</main>