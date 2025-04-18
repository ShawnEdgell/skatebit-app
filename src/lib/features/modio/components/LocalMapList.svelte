<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte'
  import LocalMapCard from './LocalMapCard.svelte'
  import type { FsEntry } from '$lib/types/fsTypes'
  import { localMaps, localMapsLoading } from '$lib/stores/mapsStore'
  import {
    localSearchQuery as localMapsSearchQuery,
    localSearchResults as localMapsSearchResults,
  } from '$lib/stores/localSearchStore'
  import { openModal } from '$lib/stores/uiStore'
  import { deleteEntry } from '$lib/services/fileService'
  import { handleError, handleSuccess } from '$lib/utils/errorHandler'
  import { draggable } from '$lib/actions/draggable'

  const dispatch = createEventDispatcher()
  let scrollContainer: HTMLElement

  type SortCriteria = 'recent' | 'alphabetical' | 'size'
  // ← typed options array
  const sortOptions: SortCriteria[] = ['recent', 'alphabetical', 'size']
  let currentSort: SortCriteria = 'recent'

  async function scrollToStart() {
    await tick()
    scrollContainer?.scrollTo({ left: 0, behavior: 'smooth' })
  }

  $: sortedMaps = [...$localMaps].sort((a, b) => {
    if (currentSort === 'alphabetical') {
      return (a.name ?? '').localeCompare(b.name ?? '', undefined, {
        sensitivity: 'base',
      })
    } else if (currentSort === 'recent') {
      return (b.modified ?? 0) - (a.modified ?? 0)
    } else {
      return (b.size ?? 0) - (a.size ?? 0)
    }
  })

  $: displayMaps = $localMapsSearchQuery.trim()
    ? $localMapsSearchResults
    : sortedMaps

  function handleRequestDelete(
    event: CustomEvent<{ path: string; name: string | null }>,
  ) {
    const { path, name } = event.detail
    if (!path) {
      handleError('Cannot delete item: Path is missing.', 'Delete Operation')
      return
    }
    openModal({
      title: 'Confirm Deletion',
      message: `Move "${name ?? 'this item'}" to the Recycle Bin?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      confirmClass: 'btn-error',
      onSave: async () => {
        try {
          await deleteEntry(path)
          handleSuccess(`"${name}" deleted successfully.`, 'Deletion')
        } catch (err) {
          handleError(err, `Deleting ${name}`)
        }
      },
    })
  }
</script>

<div class="flex flex-col md:flex-row items-center justify-between mb-4">
  <div class="flex items-center gap-2 flex-wrap">
    <h2 class="text-2xl mr-2 font-bold">Local Maps</h2>

    {#each sortOptions as criteria}
      <button
        class="badge cursor-pointer transition-colors {currentSort === criteria
          ? 'badge-primary'
          : 'badge-outline hover:bg-base-content hover:text-base-100 hover:border-base-content'}"
        on:click={async () => {
          currentSort = criteria
          await scrollToStart()
        }}
        disabled={$localMapsLoading || $localMaps.length === 0}
      >
        {#if criteria === 'recent'}Most Recent{/if}
        {#if criteria === 'alphabetical'}A‑Z{/if}
        {#if criteria === 'size'}Size{/if}
      </button>
    {/each}
  </div>

  <input
    type="text"
    placeholder="Search local maps..."
    bind:value={$localMapsSearchQuery}
    on:input={scrollToStart}
    class="input input-sm input-bordered w-full max-w-xs"
    disabled={$localMapsLoading || $localMaps.length === 0}
  />
</div>

<div class="h-51">
  {#if $localMapsLoading && $localMaps.length === 0}
    <div class="absolute inset-0 flex items-center justify-center p-4 z-10">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  {:else if !$localMapsLoading && displayMaps.length === 0}
    <div class="h-full flex items-center justify-center p-4 min-h-[10rem]">
      <p class="text-center text-base-content/60 text-sm">
        {#if $localMapsSearchQuery.trim()}
          No maps found matching '{$localMapsSearchQuery}'.
        {:else}
          No local maps found. Check settings or scan for maps.
        {/if}
      </p>
    </div>
  {:else}
    <div
      bind:this={scrollContainer}
      use:draggable
      class="flex flex-row gap-4 overflow-x-auto pb-2 select-none touch-pan-x scrollbar-thin h-full cursor-grab"
      role="list"
    >
      {#each displayMaps as map, i (map.path ?? map.name ?? i)}
        <LocalMapCard localMap={map} on:requestDelete={handleRequestDelete} />
      {/each}
    </div>

    {#if $localMapsLoading && $localMaps.length > 0}
      <div
        class="absolute inset-0 flex items-center justify-center p-4 z-10 bg-base-200/50 rounded-box"
      >
        <span class="loading loading-spinner loading-md"></span>
      </div>
    {/if}
  {/if}
</div>
