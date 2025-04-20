<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import LocalMapCard from './LocalMapCard.svelte'
  import { openModal } from '$lib/stores/uiStore'
  import { deleteEntry } from '$lib/services/fileService'
  import { draggable } from '$lib/actions/draggable'
  import { handleError, handleSuccess } from '$lib/utils/errorHandler'
  import type { FsEntry } from '$lib/types/fsTypes'

  export let maps: FsEntry[] = []
  export let loading: boolean = false
  export let searchQuery: string = ''

  const dispatch = createEventDispatcher()
  let scrollContainer: HTMLElement

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
          handleSuccess(`"${name ?? 'Item'}" deleted successfully.`, 'Deletion')
        } catch (err) {
          handleError(err, `Deleting ${name ?? 'item'}`)
        }
      },
    })
  }
</script>

<div class="relative min-h-[12rem]">
  {#if loading && maps.length === 0}
    <div class="absolute inset-0 z-10 flex items-center justify-center p-4">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  {:else if !loading && maps.length === 0}
    <div class="flex h-full min-h-[10rem] items-center justify-center p-4">
      <p class="text-base-content/60 text-center text-sm">
        {#if searchQuery.trim()}
          No maps found matching '{searchQuery}'.
        {:else}
          No local maps found. Check settings or scan for maps.
        {/if}
      </p>
    </div>
  {:else}
    <div
      bind:this={scrollContainer}
      use:draggable
      class="scrollbar-thin flex touch-pan-x flex-row gap-4 overflow-x-auto pb-2 select-none"
      role="list"
    >
      {#each maps as map, i (map.path ?? map.name ?? i)}
        <LocalMapCard localMap={map} on:requestDelete={handleRequestDelete} />
      {/each}
    </div>

    {#if loading && maps.length > 0}
      <div
        class="bg-base-200/50 rounded-box absolute inset-0 z-10 flex items-center justify-center p-4"
      >
        <span class="loading loading-spinner loading-md"></span>
      </div>
    {/if}
  {/if}
</div>
