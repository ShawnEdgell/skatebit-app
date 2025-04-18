<!-- src/lib/features/modio/components/MapCard.svelte -->
<script lang="ts">
  import type { Mod } from '$lib/types/modioTypes'
  import { formatFileSize, formatRelativeTime } from '$lib/utils/formatter'
  import { invoke } from '@tauri-apps/api/core'
  import { handleError, handleSuccess } from '$lib/utils/errorHandler'
  import { get } from 'svelte/store'
  import { mapsDirectory } from '$lib/stores/globalPathsStore'
  import { documentDir } from '@tauri-apps/api/path'
  import { normalizePath } from '$lib/services/pathService'
  import { toastStore } from '$lib/stores/uiStore' // ← import toastStore

  export let mod: Mod

  let isInstalling = false
  let installingToastId: number | null = null // ← track toast

  async function handleDownload() {
    console.log('Install button clicked')
    isInstalling = true
    // show persistent installing toast
    installingToastId = toastStore.addToast(
      `<span class="loading loading-spinner loading-sm mr-2"></span> Installing "${mod.name}"…`,
      'alert-info',
      0, // 0 = never auto-dismiss
    )

    try {
      const mapsRootAbsolutePath = get(mapsDirectory)
      if (!mapsRootAbsolutePath || mapsRootAbsolutePath.startsWith('/error')) {
        throw new Error('Maps folder path is not set or invalid.')
      }

      // determine destinationSubfolder exactly as before...
      const docDirResult = await documentDir()
      const docDir = normalizePath(docDirResult || '')
      const normMapsRoot = normalizePath(mapsRootAbsolutePath)

      let destination: string
      if (normMapsRoot && docDir && normMapsRoot.startsWith(docDir)) {
        let relativeSubfolder = normMapsRoot
          .substring(docDir.length)
          .replace(/^[\/\\]/, '')
        if (!relativeSubfolder) relativeSubfolder = '.'
        destination = relativeSubfolder
      } else if (normMapsRoot) {
        destination = normMapsRoot
      } else {
        throw new Error(`Could not determine a valid destination folder.`)
      }

      if (!mod.modfile?.download?.binary_url) {
        throw new Error('Mod file download URL is missing.')
      }

      await invoke('download_and_install', {
        url: mod.modfile.download.binary_url,
        destinationSubfolder: destination,
      })

      console.log('Download and install completed successfully.')
      handleSuccess('Map installed successfully', 'Installation')
    } catch (error) {
      handleError(error, 'Installation')
    } finally {
      // remove our persistent toast if it’s still up
      if (installingToastId !== null) {
        toastStore.removeToast(installingToastId)
        installingToastId = null
      }
      isInstalling = false
    }
  }
</script>

<div
  role="listitem"
  class="relative card shadow-md overflow-hidden flex-shrink-0 group aspect-video bg-base-200 h-45"
  title={mod.profile_url}
>
  {#if mod.logo?.thumb_320x180}
    <img
      src={mod.logo.thumb_320x180}
      alt={mod.name || ''}
      class="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
      loading="lazy"
      draggable="false"
    />
  {:else}
    <div
      class="absolute inset-0 grid place-content-center bg-base-300 text-base-content/50 text-sm"
    >
      No Image
    </div>
  {/if}

  {#if mod.modfile?.filesize}
    <span
      class="absolute top-1 right-1 bg-black/50 text-white text-xs rounded px-1.5 py-0.5"
    >
      {formatFileSize(mod.modfile.filesize)}
    </span>
  {/if}

  <div
    class="absolute bottom-0 z-10 w-full p-2.5 bg-gradient-to-t from-black/90 to-transparent pointer-events-none"
  >
    <span
      class="font-semibold text-base md:text-lg text-white shadow-md line-clamp-2 leading-tight"
    >
      {mod.name || 'Untitled Mod'}
    </span>
    {#if mod.submitted_by || mod.date_updated}
      <div class="text-xs mt-1 flex items-center gap-x-1.5 text-white">
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
  </div>

  <div
    class="absolute inset-0 z-20 flex items-center justify-center gap-3 bg-neutral/70 opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none"
  >
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
      <span class="badge badge-sm badge-error pointer-events-auto opacity-80"
        >No file</span
      >
    {/if}
  </div>
</div>
