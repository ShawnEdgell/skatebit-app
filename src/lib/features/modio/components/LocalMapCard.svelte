<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import type { FsEntry } from '$lib/types/fsTypes'
  import BaseCard from './BaseCard.svelte'
  import { revealItemInDir } from '@tauri-apps/plugin-opener'
  import { formatFileSize } from '$lib/utils/formatter'
  import { normalizePath } from '$lib/services/pathService'
  import { convertFileSrc } from '@tauri-apps/api/core'
  import { handleError } from '$lib/utils/errorHandler'

  const dispatch = createEventDispatcher()
  export let localMap: FsEntry

  let assetUrl = ''
  let isVisible = false
  let observer: IntersectionObserver
  let el: HTMLElement

  onMount(() => {
    observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            isVisible = true
            observer.unobserve(el)
          }
        }
      },
      { threshold: 0.1 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  })

  $: if (isVisible && localMap.thumbnailPath) {
    try {
      assetUrl = convertFileSrc(localMap.thumbnailPath)
    } catch {
      assetUrl = '' // Reset if conversion fails
    }
  } else if (!localMap.thumbnailPath) {
    assetUrl = '' // Ensure assetUrl is cleared if no thumbnailPath
  }

  async function openInExplorer() {
    if (!localMap.path) return
    try {
      await revealItemInDir(normalizePath(localMap.path))
    } catch (error) {
      handleError(error, `Failed to open ${localMap.name} in explorer`)
    }
  }

  function deleteMap() {
    dispatch('requestDelete', { path: localMap.path, name: localMap.name })
  }
</script>

<div bind:this={el} class="relative aspect-video w-80 flex-shrink-0">
  {#if isVisible}
    <BaseCard
      imageUrl={assetUrl}
      imageAlt={localMap.name ?? ''}
      fallbackContent={localMap.isDirectory ? '📁' : '📄'}
      fallbackClass="text-5xl"
      badgeText={localMap.size != null ? formatFileSize(localMap.size) : ''}
      title={localMap.name ??
        (localMap.isDirectory ? 'Unnamed Folder' : 'Unnamed Map')}
      cardTitleAttr={localMap.path ?? ''}
    >
      <svelte:fragment slot="info" />

      <svelte:fragment slot="actions">
        <button
          title="Open in Explorer"
          class="btn btn-secondary btn-sm pointer-events-auto"
          on:click|stopPropagation={openInExplorer}
        >
          Open
        </button>
        <button
          title="Delete"
          class="btn btn-error btn-sm pointer-events-auto"
          on:click|stopPropagation={deleteMap}
        >
          Delete
        </button>
      </svelte:fragment>
    </BaseCard>
  {:else}
    <div class="bg-base-300/20 h-full w-full animate-pulse rounded-lg"></div>
  {/if}
</div>
