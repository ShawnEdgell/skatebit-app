<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import LocalMapCard from './LocalMapCard.svelte'
  import { openModal } from '$lib/stores/uiStore'
  import { deleteEntry } from '$lib/services/fileService'
  import { draggable } from '$lib/actions/draggable'
  import { handleError, handleSuccess } from '$lib/utils/errorHandler'
  import type { FsEntry } from '$lib/types/fsTypes'
  import { refreshLocalMaps } from '$lib/stores/mapsStore'

  export let maps: FsEntry[] = []
  export let loading: boolean = false
  export let searchQuery = ''

  const dispatch = createEventDispatcher()
  let scrollContainer: HTMLElement

  function handleRequestDelete(
    event: CustomEvent<{ path: string; name: string | null }>,
  ) {
    const { path, name } = event.detail
    if (!path) {
      handleError('Cannot delete item: Path is missing.', 'Delete')
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
          handleSuccess(`"${name ?? 'Item'}" deleted.`, 'Deletion')
          await refreshLocalMaps()
        } catch (err) {
          handleError(err, `Deleting ${name ?? 'item'}`)
        }
      },
    })
  }
</script>

<div class="relative h-39">
  {#if loading && maps.length === 0}
    <!-- full‐container spinner on first load -->
    <div
      class="bg-base-100/50 absolute inset-0 z-10 flex items-center justify-center"
    >
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  {/if}

  {#if !loading && maps.length === 0}
    <!-- empty state -->
    <div class="absolute inset-0 flex items-center justify-center p-4">
      <p class="text-base-content/60 text-center text-sm">
        {#if searchQuery.trim()}
          No maps matching “{searchQuery}”.
        {:else}
          No local maps found.
        {/if}
      </p>
    </div>
  {:else}
    <!-- always render the strip, cards appear as soon as available -->
    <div
      bind:this={scrollContainer}
      use:draggable
      class="scrollbar-thin flex h-full touch-pan-x flex-row gap-4 overflow-x-auto pb-2 select-none overflow-hidden"
      role="list"
    >
      {#each maps as map (map.path)}
        <LocalMapCard localMap={map} on:requestDelete={handleRequestDelete} />
      {/each}

      {#if loading}
        <!-- inline spinner at the end during incremental loads -->
        <div class="flex items-center px-4">
          <span class="loading loading-spinner loading-md"></span>
        </div>
      {/if}
    </div>
  {/if}
</div>
