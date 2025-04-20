<script lang="ts">
  import { onDestroy, tick } from 'svelte'
  import { browser } from '$app/environment'
  import { get } from 'svelte/store'
  import MapList from './components/MapList.svelte'
  import LocalMapList from './components/LocalMapList.svelte' // Keep this import
  import {
    modioSearchQuery,
    modioSearchResults,
    modioSortOrder,
  } from '$lib/stores/modioSearchStore'
  import {
    modioMapsLoading,
    localMaps,
    localMapsLoading,
  } from '$lib/stores/mapsStore' // Import local maps stores
  import { mapsDirectory } from '$lib/stores/globalPathsStore'
  import { activeDropTargetInfo } from '$lib/stores/dndStore'
  import { localSearchQuery } from '$lib/stores/localSearchStore' // Import local search query store
  import type { FsEntry } from '$lib/types/fsTypes' // Import type

  // --- DnD Context Logic ---
  $: if (browser && $mapsDirectory) {
    activeDropTargetInfo.set({ path: $mapsDirectory, label: 'Maps Folder' })
  } else if (browser) {
    activeDropTargetInfo.set({ path: null, label: null })
  }
  onDestroy(() => {
    if (browser && get(activeDropTargetInfo).path === get(mapsDirectory)) {
      activeDropTargetInfo.set({ path: null, label: null })
    }
  })
  // --- End DnD Context Logic ---

  // --- Modio Section Logic ---
  let modioVisibleCount = 10 // Renamed for clarity
  type ModioSortValue = 'recent' | 'popular' | 'downloads' // Renamed for clarity
  interface ModioSortOption {
    label: string
    value: ModioSortValue
  } // Renamed for clarity
  const modioSortOptions: ModioSortOption[] = [
    // Renamed for clarity
    { label: 'Most Recent', value: 'recent' },
    { label: 'Popular', value: 'popular' },
    { label: 'Downloads', value: 'downloads' },
  ]
  async function selectModioSort(value: ModioSortValue) {
    // Renamed for clarity
    if (value !== $modioSortOrder) {
      modioSortOrder.set(value)
      modioVisibleCount = 10
      await tick()
      document
        .querySelector('#modio-map-list-container .scrollbar-thin')
        ?.scrollTo({ left: 0, behavior: 'smooth' })
    }
  }
  function handleModioLoadMore() {
    // Renamed for clarity
    if (modioVisibleCount < $modioSearchResults.length) modioVisibleCount += 10
  }
  if (browser && !$modioSortOrder) {
    modioSortOrder.set(modioSortOptions[0].value)
  }
  // --- End Modio Section Logic ---

  // +++ Local Maps Section Logic +++
  type LocalSortCriteria = 'recent' | 'alphabetical' | 'size'
  interface LocalSortOption {
    label: string
    value: LocalSortCriteria
  }
  const localSortOptions: LocalSortOption[] = [
    { label: 'Most Recent', value: 'recent' },
    { label: 'A-Z', value: 'alphabetical' },
    { label: 'Size', value: 'size' },
  ]
  let localSortCriteria: LocalSortCriteria = 'recent'
  let localScrollContainer: HTMLElement | undefined // Optional: if you need to scroll local list too

  async function selectLocalSort(criteria: LocalSortCriteria) {
    if (criteria !== localSortCriteria) {
      localSortCriteria = criteria
      await tick()
      // Scroll local list if needed (requires bind:this on its scroll container)
      // localScrollContainer?.scrollTo({ left: 0, behavior: 'smooth' });
    }
  }

  // Reactive calculation for sorted local maps
  $: sortedLocalMaps = [...$localMaps].sort((a, b) => {
    if (localSortCriteria === 'alphabetical') {
      return (a.name ?? '').localeCompare(b.name ?? '', undefined, {
        sensitivity: 'base',
      })
    } else if (localSortCriteria === 'recent') {
      return (b.modified ?? 0) - (a.modified ?? 0)
    } else {
      // size
      return (b.size ?? 0) - (a.size ?? 0)
    }
  })

  // Reactive calculation for filtered local maps (uses localSearchQuery store)
  $: displayedLocalMaps = !$localSearchQuery.trim()
    ? sortedLocalMaps
    : sortedLocalMaps.filter((map) =>
        map.name
          ?.toLowerCase()
          .includes($localSearchQuery.trim().toLowerCase()),
      )
  // +++ End Local Maps Section Logic +++
</script>

<svelte:head>
  <title>Maps - XL Web Manager</title>
</svelte:head>

<main class="bg-base-300 mx-auto flex h-full w-full flex-col gap-4 px-4">
  <div class="bg-base-100 rounded-box z-10 p-4 shadow-md">
    <div
      class="flex flex-col items-start justify-between gap-2 md:flex-row md:items-center"
    >
      <div class="flex flex-wrap items-center gap-2">
        <h2 class="mr-2 text-2xl font-bold">Mod.io Maps</h2>
        {#each modioSortOptions as opt}
          <button
            type="button"
            class="badge cursor-pointer transition-colors
              {$modioSortOrder === opt.value
              ? 'badge-primary'
              : 'badge-outline hover:bg-base-content hover:text-base-100 hover:border-base-content'}"
            on:click={() => selectModioSort(opt.value)}
            disabled={$modioMapsLoading}
          >
            {opt.label}
          </button>
        {/each}
      </div>
      <input
        type="text"
        placeholder="Search mod.io maps…"
        bind:value={$modioSearchQuery}
        class="input input-sm input-bordered w-64"
        disabled={$modioMapsLoading}
      />
    </div>

    <div class="mt-4 h-52 overflow-hidden" id="modio-map-list-container">
      {#if $modioMapsLoading && $modioSearchResults.length === 0}
        <div class="flex h-full items-center justify-center">
          <span class="loading loading-spinner loading-lg"></span>
        </div>
      {:else if !$modioMapsLoading && $modioSearchResults.length === 0}
        <div class="flex h-full items-center justify-center p-4">
          <p class="text-base-content/60 text-sm">
            {#if $modioSearchQuery.trim()}
              No maps matching “{$modioSearchQuery}” found on mod.io.
            {:else}
              No mod.io maps found.
            {/if}
          </p>
        </div>
      {:else}
        <MapList
          mods={$modioSearchResults}
          visibleCount={modioVisibleCount}
          loading={$modioMapsLoading}
          on:loadMore={handleModioLoadMore}
        />
      {/if}
    </div>
  </div>

  <div class="bg-base-100 rounded-box z-10 p-4 shadow-md">
    <div
      class="mb-4 flex flex-col items-start justify-between gap-2 md:flex-row md:items-center"
    >
      <div class="flex flex-wrap items-center gap-2">
        <h2 class="mr-2 text-2xl font-bold">Local Maps</h2>
        {#each localSortOptions as opt (opt.value)}
          <button
            class="badge cursor-pointer transition-colors {localSortCriteria ===
            opt.value
              ? 'badge-primary'
              : 'badge-outline hover:bg-base-content hover:text-base-100 hover:border-base-content'}"
            on:click={() => selectLocalSort(opt.value)}
            disabled={$localMapsLoading || $localMaps.length === 0}
          >
            {opt.label}
          </button>
        {/each}
      </div>

      <input
        type="text"
        placeholder="Search local maps..."
        bind:value={$localSearchQuery}
        class="input input-sm input-bordered w-64"
        disabled={$localMapsLoading || $localMaps.length === 0}
      />
    </div>
    <LocalMapList
      maps={displayedLocalMaps}
      loading={$localMapsLoading}
      searchQuery={$localSearchQuery}
    />
  </div>
</main>
