<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import LocalModCard from './LocalModCard.svelte'
  import { draggable } from '$lib/actions/draggable'
  import { openModal } from '$lib/stores/uiStore'
  import { deleteEntry } from '$lib/services/fileService'
  import { handleError, handleSuccess } from '$lib/utils/errorHandler'
  import type { FsEntry } from '$lib/types/fsTypes'
  import { refreshLocalMods } from '$lib/stores/modsStore'
  import { open } from '@tauri-apps/plugin-dialog'
  import {
    modsDirectory,
    initializeGlobalPaths,
  } from '$lib/stores/globalPathsStore'

  export let mods: FsEntry[] = []
  export let loading: boolean = false
  export let searchQuery: string = ''

  const dispatch = createEventDispatcher()
  let scrollContainer: HTMLElement

  async function promptSetGamePath() {
    const selected = await open({ directory: true })
    if (typeof selected === 'string') {
      modsDirectory.set(`${selected}/Mods`)
      await initializeGlobalPaths()
      await refreshLocalMods()
    }
  }

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
          await refreshLocalMods()
        } catch (err) {
          handleError(err, `Deleting ${name ?? 'item'}`)
        }
      },
    })
  }
</script>

<div class="relative h-51">
  {#if loading && mods.length === 0}
    <div
      class="bg-base-100/50 absolute inset-0 z-10 flex items-center justify-center"
    >
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  {/if}

  {#if !loading && mods.length === 0}
    <div class="absolute inset-0 flex items-center justify-center p-4">
      <div
        class="text-base-content/60 flex flex-col items-center gap-2 text-center text-sm"
      >
        {#if searchQuery.trim()}
          <p>No mods matching “{searchQuery}”.</p>
        {:else}
          <p>No local mods found.</p>
          <button
            class="btn btn-sm btn-outline mt-2"
            on:click={promptSetGamePath}
          >
            Set Skater XL Game Folder
          </button>
        {/if}
      </div>
    </div>
  {:else}
    <div
      bind:this={scrollContainer}
      use:draggable
      class="scrollbar-thin flex h-full touch-pan-x flex-row gap-4 overflow-x-auto pb-2 select-none"
      role="list"
    >
      {#each mods as mod (mod.path)}
        <LocalModCard localMod={mod} on:requestDelete={handleRequestDelete} />
      {/each}

      {#if loading}
        <div class="flex items-center px-4">
          <span class="loading loading-spinner loading-md"></span>
        </div>
      {/if}
    </div>
  {/if}
</div>
