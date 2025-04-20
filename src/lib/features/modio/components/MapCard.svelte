<script lang="ts">
  import { invoke } from '@tauri-apps/api/core'
  import { documentDir } from '@tauri-apps/api/path'
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

  async function handleDownload() {
    isInstalling = true
    installingToastId = toastStore.addToast(
      `<span class="loading loading-spinner loading-sm mr-2"></span> Installing "${mod.name}"…`,
      'alert-info',
      0,
    )

    try {
      const mapsRootAbsolutePath = get(mapsDirectory)
      if (!mapsRootAbsolutePath || mapsRootAbsolutePath.startsWith('/error')) {
        throw new Error('Maps folder path is not set or invalid.')
      }
      if (!mod.modfile?.download?.binary_url) {
        throw new Error('Mod file download URL is missing.')
      }

      const docDirResult = await documentDir()
      const docDir = normalizePath(docDirResult || '')
      const normMapsRoot = normalizePath(mapsRootAbsolutePath)

      let destination: string
      if (normMapsRoot && docDir && normMapsRoot.startsWith(docDir)) {
        let relativeSubfolder = normMapsRoot
          .substring(docDir.length)
          .replace(/^[/|\\]+/, '') // Use regex for robustness
        destination = relativeSubfolder || '.' // Use current dir if it's the root
      } else if (normMapsRoot) {
        destination = normMapsRoot
      } else {
        throw new Error(`Could not determine a valid destination folder.`)
      }

      await invoke('download_and_install', {
        url: mod.modfile.download.binary_url,
        destinationSubfolder: destination,
      })

      handleSuccess(`Map "${mod.name}" installed successfully`, 'Installation')
    } catch (error) {
      handleError(error, `Installation failed for ${mod.name}`)
    } finally {
      if (installingToastId !== null) {
        toastStore.removeToast(installingToastId)
        installingToastId = null
      }
      isInstalling = false
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
    {#if mod.submitted_by || mod.date_updated}
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
    <a
      title="View Details"
      href={mod.profile_url}
      target="_blank"
      rel="noopener noreferrer"
      class="btn btn-secondary btn-sm pointer-events-auto"
      on:click|stopPropagation>View Details</a
    >
    {#if mod.modfile?.download?.binary_url}
      <button
        title="Install Map"
        on:click|stopPropagation={handleDownload}
        disabled={isInstalling}
        class="btn btn-primary btn-sm pointer-events-auto"
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
