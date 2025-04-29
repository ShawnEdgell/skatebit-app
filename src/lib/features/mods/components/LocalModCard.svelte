<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import type { FsEntry } from '$lib/types/fsTypes'
  import BaseCard from '$lib/components/BaseCard.svelte'
  import { revealItemInDir } from '@tauri-apps/plugin-opener'
  import { formatFileSize } from '$lib/utils/formatter'
  import { normalizePath } from '$lib/services/pathService'
  import { convertFileSrc } from '@tauri-apps/api/core'
  import { handleError } from '$lib/utils/errorHandler'

  export let localMod: FsEntry

  const dispatch = createEventDispatcher()

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

  $: if (isVisible && localMod.thumbnailPath) {
    try {
      assetUrl = convertFileSrc(localMod.thumbnailPath)
    } catch {
      assetUrl = ''
    }
  } else if (!localMod.thumbnailPath) {
    assetUrl = ''
  }

  async function openInExplorer() {
    if (!localMod.path) return
    try {
      await revealItemInDir(normalizePath(localMod.path))
    } catch (error) {
      handleError(error, `Failed to open ${localMod.name} in explorer`)
    }
  }

  function deleteMod() {
    dispatch('requestDelete', { path: localMod.path, name: localMod.name })
  }
</script>

<div bind:this={el} class="relative aspect-video w-80 flex-shrink-0">
  {#if isVisible}
    <BaseCard
      imageUrl={assetUrl}
      imageAlt={localMod.name ?? ''}
      fallbackContent={localMod.isDirectory ? '📁' : '📄'}
      fallbackClass="text-5xl"
      badgeText={localMod.size != null ? formatFileSize(localMod.size) : ''}
      title={localMod.name ??
        (localMod.isDirectory ? 'Unnamed Folder' : 'Unnamed Mod')}
      cardTitleAttr={localMod.path ?? ''}
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
          on:click|stopPropagation={deleteMod}
        >
          Delete
        </button>
      </svelte:fragment>
    </BaseCard>
  {:else}
    <div class="bg-base-300/20 h-full w-full animate-pulse rounded-lg"></div>
  {/if}
</div>
