<script lang="ts">
  import ModList from './components/ModList.svelte'
  import LocalModList from './components/LocalModList.svelte'
  import ListToolbar from '$lib/components/ListToolBar.svelte'

  import { page } from '$app/stores'
  import { browser } from '$app/environment'
  import { onDestroy, tick, onMount } from 'svelte'

  import { activeDropTargetInfo } from '$lib/stores/dndStore'
  import { modsDirectory } from '$lib/stores/globalPathsStore'
  import {
    modsSearchQuery,
    modsSortOrder,
    modsLoading,
    modsResults,
    refreshMods,
  } from '$lib/stores/modsStore'
  import {
    localMods,
    localModsLoading,
    refreshLocalMods,
  } from '$lib/stores/modsStore'
  import { localSearchQuery } from '$lib/stores/localSearchStore'

  import { handleError } from '$lib/utils/errorHandler'

  type ModsSortValue = 'recent' | 'popular' | 'downloads'
  type LocalSortValue = 'recent' | 'alphabetical' | 'size'

  onMount(() => {
    if ($modsResults.length === 0 && !$modsLoading) {
      console.log('[ModsLayout] Triggering initial mod refresh...')
      refreshMods().catch((e) =>
        handleError(e, '[ModsLayout] Failed initial mod refresh'),
      )
    } else {
      if (!$modsLoading) modsLoading.set(false)
    }
  })

  const modsSortOptions: { label: string; value: ModsSortValue }[] = [
    { label: 'Most Recent', value: 'recent' },
    { label: 'Popular', value: 'popular' },
    { label: 'Downloads', value: 'downloads' },
  ]

  let modsVisibleCount = 10
  function selectModsSort(detail: string) {
    const v = detail as ModsSortValue
    if (v !== $modsSortOrder) {
      modsSortOrder.set(v)
      modsVisibleCount = 10

      tick().then(() => {
        document
          .querySelector('#mods-list-container .scrollbar-thin')
          ?.scrollTo({ top: 0, behavior: 'smooth' })
      })
    }
  }
  function handleModsLoadMore() {
    if (modsVisibleCount < $modsResults.length) {
      modsVisibleCount += 10
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

  $: sortedAndFilteredLocalMods = (() => {
    const modsToSort = Array.isArray($localMods) ? $localMods : []
    const filtered = !$localSearchQuery.trim()
      ? modsToSort
      : modsToSort.filter((m) =>
          m.name
            ?.toLowerCase()
            .includes($localSearchQuery.trim().toLowerCase()),
        )
    const sorted = [...filtered]

    switch (localSortOrder) {
      case 'alphabetical':
        sorted.sort(
          (a, b) =>
            a.name?.toLowerCase().localeCompare(b.name?.toLowerCase() ?? '') ??
            0,
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

  $: if (
    browser &&
    ($page.url.pathname === '/mods' || $page.url.pathname.startsWith('/mods'))
  ) {
    activeDropTargetInfo.set({ path: $modsDirectory, label: 'Mods Folder' })
  } else if (browser) {
    activeDropTargetInfo.set({ path: null, label: null })
  }

  onDestroy(() => {
    activeDropTargetInfo.set({ path: null, label: null })
  })
</script>

<svelte:head><title>Mods – XL Web Manager</title></svelte:head>

<main class="bg-base-300 mx-auto flex h-full w-full flex-col gap-4 px-4">
  <div class="bg-base-100 rounded-box flex flex-col gap-4 p-4 shadow-md">
    <ListToolbar
      title="Mods"
      searchQuery={$modsSearchQuery}
      on:search={(e) => modsSearchQuery.set(e.detail)}
      sortOptions={modsSortOptions}
      sortOrder={$modsSortOrder}
      on:sort={(e) => selectModsSort(e.detail)}
      disabled={$modsLoading}
      on:refresh={() => refreshMods()}
    />
    <div id="mods-list-container" class="min-h-0 flex-1">
      <ModList
        mods={$modsResults}
        loading={$modsLoading}
        visibleCount={modsVisibleCount}
        on:loadMore={handleModsLoadMore}
      />
    </div>
  </div>

  <div class="bg-base-100 rounded-box flex flex-col gap-4 p-4 shadow-md">
    <ListToolbar
      title="Local Mods"
      searchQuery={$localSearchQuery}
      on:search={(e) => localSearchQuery.set(e.detail)}
      sortOptions={localSortOptions}
      sortOrder={localSortOrder}
      on:sort={(e) => selectLocalSort(e.detail)}
      disabled={$localModsLoading || $localMods.length === 0}
      on:refresh={() => refreshLocalMods()}
    />
    <div class="min-h-0 flex-1">
      <LocalModList
        mods={sortedAndFilteredLocalMods}
        searchQuery={$localSearchQuery}
      />
    </div>
  </div>
</main>
