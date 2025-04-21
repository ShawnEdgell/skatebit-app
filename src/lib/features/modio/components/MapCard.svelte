<script lang="ts">
  import { invoke } from '@tauri-apps/api/core'
  import { documentDir } from '@tauri-apps/api/path'
  import { open } from '@tauri-apps/plugin-shell'
  import { get } from 'svelte/store'
  import { formatFileSize, formatRelativeTime } from '$lib/utils/formatter'
  import { handleError, handleSuccess } from '$lib/utils/errorHandler'
  import { mapsDirectory } from '$lib/stores/globalPathsStore'
  import { normalizePath } from '$lib/services/pathService'
  import { toastStore } from '$lib/stores/uiStore'
  import type { Mod } from '$lib/types/modioTypes'
  import BaseCard from './BaseCard.svelte'

  export let mod: Mod

  let isInstalling = false
  let installingToastId: number | null = null

  async function handleDownload(event: MouseEvent) {
    event.stopPropagation()
    isInstalling = true
    installingToastId = toastStore.addToast(
      `<span class="loading loading-spinner loading-sm mr-2"></span> Installing "${mod.name}"…`,
      'alert-info',
      0,
    )

    try {
      const mapsRoot = get(mapsDirectory)
      if (!mapsRoot || mapsRoot.startsWith('/error')) {
        throw new Error('Maps folder path is not set or invalid.')
      }
      if (!mod.modfile?.download?.binary_url) {
        throw new Error('Mod file download URL is missing.')
      }

      const docDirResult = await documentDir()
      const docDir = normalizePath(docDirResult || '')
      const normMapsRoot = normalizePath(mapsRoot)

      let destination: string
      if (normMapsRoot.startsWith(docDir)) {
        let rel = normMapsRoot.slice(docDir.length).replace(/^[/\\]+/, '')
        destination = rel || '.'
      } else {
        destination = normMapsRoot
      }

      await invoke('download_and_install', {
        url: mod.modfile.download.binary_url,
        destinationSubfolder: destination,
      })

      handleSuccess(`Map "${mod.name}" installed successfully`, 'Installation')
    } catch (err) {
      handleError(err, `Installation failed for ${mod.name}`)
    } finally {
      if (installingToastId !== null) {
        toastStore.removeToast(installingToastId)
        installingToastId = null
      }
      isInstalling = false
    }
  }

  function handleViewDetails(event: MouseEvent) {
    event.stopPropagation()
    if (mod.profile_url) {
      open(mod.profile_url).catch((err) =>
        handleError(err, 'Opening external browser'),
      )
    }
  }
</script>

<BaseCard
  imageUrl={mod.logo?.thumb_320x180 ?? ''}
  imageAlt={mod.name ?? ''}
  fallbackContent="📄"
  fallbackClass="text-5xl"
  badgeText={mod.modfile?.filesize ? formatFileSize(mod.modfile.filesize) : ''}
  title={mod.name ?? 'Untitled Mod'}
  cardTitleAttr={mod.profile_url}
>
  <svelte:fragment slot="info">
    {#if mod.submitted_by?.username || mod.date_updated}
      <div class="mt-1 flex items-center gap-x-1.5 text-xs text-white">
        {#if mod.submitted_by?.username}
          <span>{mod.submitted_by.username}</span>
        {/if}
        {#if mod.submitted_by && mod.date_updated}
          <span>|</span>
        {/if}
        {#if mod.date_updated}
          <span title={new Date(mod.date_updated * 1000).toLocaleString()}>
            {formatRelativeTime(mod.date_updated)}
          </span>
        {/if}
      </div>
    {/if}
  </svelte:fragment>

  <svelte:fragment slot="actions">
    <button
      title="View Details"
      class="btn btn-secondary btn-sm pointer-events-auto"
      on:click={handleViewDetails}
    >
      View Details
    </button>
    {#if mod.modfile?.download?.binary_url}
      <button
        title="Install Map"
        class="btn btn-primary btn-sm pointer-events-auto"
        on:click={handleDownload}
        disabled={isInstalling}
      >
        {#if isInstalling}
          <span class="loading loading-spinner loading-sm"></span> Installing...
        {:else}
          Install
        {/if}
      </button>
    {:else}
      <span class="badge badge-sm badge-error pointer-events-auto opacity-80">
        No file
      </span>
    {/if}
  </svelte:fragment>
</BaseCard>
