<!-- src/lib/components/LocalMapCard.svelte -->
<script lang="ts">
  import type { FsEntry } from '$lib/types/fsTypes'
  import GenericCard from './GenericCard.svelte'
  import { revealItemInDir } from '@tauri-apps/plugin-opener'
  import { createEventDispatcher, onMount, onDestroy } from 'svelte'
  import { formatFileSize } from '$lib/utils/formatter'
  import { normalizePath } from '$lib/services/pathService'
  import { convertFileSrc } from '@tauri-apps/api/core'

  export let localMap: FsEntry
  const dispatch = createEventDispatcher()

  let observer: IntersectionObserver
  let cardElement: HTMLElement
  let isVisible = false
  let assetUrl = ''

  $: canPerformActions = !!localMap?.path

  $: if (localMap?.thumbnailPath) {
    try {
      assetUrl = convertFileSrc(localMap.thumbnailPath)
    } catch (e) {
      console.error(
        `[${localMap.name}] Failed to convert path to asset URL: ${localMap.thumbnailPath}`,
        e,
      )
      assetUrl = ''
    }
  } else {
    assetUrl = ''
  }

  onMount(() => {
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            isVisible = true
            // Optional: Unobserve once visible if you don't need it anymore
            // observer.unobserve(cardElement);
          } else {
            // Optional: Set isVisible to false if you want to unload
            // the card when it scrolls out of view (might cause flicker on fast scroll)
            // isVisible = false;
          }
        })
      },
      { threshold: 0.1 }, // Adjust threshold as needed
    )

    if (cardElement) observer.observe(cardElement)

    return () => {
      observer?.disconnect()
    }
  })

  async function openInExplorer() {
    if (!localMap?.path) return
    try {
      const normalized = normalizePath(localMap.path)
      if (normalized) {
        await revealItemInDir(normalized)
      } else {
        console.error('Cannot open in explorer: Normalized path is null.')
      }
    } catch (error) {
      console.error('Error using opener plugin:', error)
    }
  }

  function triggerDelete(e: MouseEvent) {
    e.stopPropagation()
    if (!localMap?.path) return
    dispatch('requestDelete', { path: localMap.path, name: localMap.name })
  }
</script>

<div bind:this={cardElement} class="relative flex-shrink-0 w-80 aspect-video">
  {#if isVisible}
    <GenericCard
      imageUrl={assetUrl}
      fallbackIcon={localMap?.isDirectory ? '📁' : '📄'}
      badgeText={localMap?.size != null ? formatFileSize(localMap.size) : ''}
      title={localMap?.name ?? 'Unnamed Map'}
    >
      <span slot="overlay">
        <button
          title="Open in Explorer"
          class="btn btn-secondary btn-sm pointer-events-auto"
          on:click|preventDefault|stopPropagation={openInExplorer}
          disabled={!canPerformActions}>Open</button
        >
        <button
          title="Delete"
          class="btn btn-error btn-sm pointer-events-auto"
          on:click|preventDefault|stopPropagation={triggerDelete}
          disabled={!canPerformActions}>Delete</button
        >
      </span>
    </GenericCard>
  {:else}
    <!-- Placeholder to maintain layout before the card becomes visible -->
    <div class="w-full h-full bg-base-300/20 rounded-lg animate-pulse"></div>
  {/if}
  <!-- Removed the loading spinner overlay as asset loading is handled by the browser -->
</div>
