<script lang="ts">
  import { onDestroy, tick } from 'svelte'
  import { browser } from '$app/environment'
  import { get } from 'svelte/store'

  import MapList from './components/MapList.svelte'
  import LocalMapList from './components/LocalMapList.svelte'

  import {
    modioSearchQuery,
    modioSearchResults,
    modioSortOrder,
  } from '$lib/stores/modioSearchStore'
  import {
    modioMapsLoading,
    localMaps,
    localMapsLoading,
  } from '$lib/stores/mapsStore'
  import { localSearchQuery } from '$lib/stores/localSearchStore'

  // --- mod.io maps sorting & pagination ---
  let modioVisibleCount = 10
  type ModioSortValue = 'recent' | 'popular' | 'downloads'
  interface ModioSortOption {
    label: string
    value: ModioSortValue
  }
  const modioSortOptions: ModioSortOption[] = [
    { label: 'Most Recent', value: 'recent' },
    { label: 'Popular', value: 'popular' },
    { label: 'Downloads', value: 'downloads' },
  ]

  async function selectModioSort(value: ModioSortValue) {
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
    if (modioVisibleCount < $modioSearchResults.length) {
      modioVisibleCount += 10
    }
  }

  if (browser && !$modioSortOrder) {
    modioSortOrder.set(modioSortOptions[0].value)
  }

  // --- local maps sorting & filtering ---
  type LocalSortCriteria = 'recent' | 'alphabetical' | 'size'
  interface LocalSortOption {
    label: string
    value: LocalSortCriteria
  }
  const localSortOptions: LocalSortOption[] = [
    { label: 'Most Recent', value: 'recent' },
    { label: 'A‑Z', value: 'alphabetical' },
    { label: 'Size', value: 'size' },
  ]

  let localSortCriteria: LocalSortCriteria = 'recent'

  async function selectLocalSort(criteria: LocalSortCriteria) {
    if (criteria !== localSortCriteria) {
      localSortCriteria = criteria
      await tick()
      // You could scroll local list container here if you bind it
    }
  }

  $: sortedLocalMaps = [...$localMaps].sort((a, b) => {
    if (localSortCriteria === 'alphabetical') {
      return (a.name ?? '').localeCompare(b.name ?? '', undefined, {
        sensitivity: 'base',
      })
    }
    if (localSortCriteria === 'recent') {
      return (b.modified ?? 0) - (a.modified ?? 0)
    }
    // size
    return (b.size ?? 0) - (a.size ?? 0)
  })

  $: displayedLocalMaps = !$localSearchQuery.trim()
    ? sortedLocalMaps
    : sortedLocalMaps.filter((map) =>
        map.name
          ?.toLowerCase()
          .includes($localSearchQuery.trim().toLowerCase()),
      )
</script>

<svelte:head>
  <title>Maps – XL Web Manager</title>
</svelte:head>

<main class="bg-base-300 mx-auto flex h-full w-full flex-col gap-4 px-4">
  <!-- Mod.io Maps Section -->
  <div class="bg-base-100 rounded-box p-4 shadow-md">
    <div
      class="flex flex-col items-start justify-between gap-2 md:flex-row md:items-center"
    >
      <div class="flex flex-wrap items-center gap-2">
        <h2 class="mr-2 text-2xl font-bold">Mod.io Maps</h2>
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
              No maps matching “{$modioSearchQuery}” found.
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

  <!-- Local Maps Section -->
  <div class="bg-base-100 rounded-box p-4 shadow-md">
    <div
      class="flex flex-col items-start justify-between gap-2 md:flex-row md:items-center"
    >
      <div class="mb-4 flex flex-wrap items-center gap-2">
        <h2 class="mr-2 text-2xl font-bold">Local Maps</h2>
        {#each localSortOptions as opt}
          <button
            class="badge cursor-pointer transition-colors
              {localSortCriteria === opt.value
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
        placeholder="Search local maps…"
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
