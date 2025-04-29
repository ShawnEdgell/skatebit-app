<script lang="ts">
  import { invoke } from '@tauri-apps/api/core'
  import { documentDir } from '@tauri-apps/api/path'
  import { open } from '@tauri-apps/plugin-shell'
  import { get } from 'svelte/store'
  import { downloadProgress } from '$lib/stores/downloadProgressStore'
  import { handleError } from '$lib/utils/errorHandler'
  import { normalizePath } from '$lib/services/pathService'
  import { modsDirectory } from '$lib/stores/globalPathsStore'
  import { formatFileSize, formatRelativeTime } from '$lib/utils/formatter'
  import BaseCard from '$lib/components/BaseCard.svelte'

  export let mod: any

  let isInstalling = false

  async function handleDownload(event: MouseEvent) {
    event.stopPropagation()
    isInstalling = true

    try {
      const modsRoot = get(modsDirectory)
      if (!modsRoot || modsRoot.startsWith('/error')) {
        throw new Error('Maps folder path is invalid.')
      }

      const url = mod.modfile?.download?.binary_url
      if (!url) throw new Error('Download URL is missing.')

      const docDirResult = await documentDir()
      const docDir = normalizePath(docDirResult || '')
      const normMapsRoot = normalizePath(modsRoot)

      const destination = normMapsRoot.startsWith(docDir)
        ? normMapsRoot.slice(docDir.length).replace(/^[/\\]+/, '') || '.'
        : normMapsRoot

      downloadProgress.update((prev) => ({
        ...prev,
        [url]: {
          step: 'downloading',
          progress: 0,
          message: 'Starting...',
          source: url,
          label: mod.name,
        },
      }))

      await invoke('download_and_install', {
        url,
        destinationSubfolder: destination,
      })
    } catch (err) {
      handleError(err, `Installation failed for ${mod.name}`)
    } finally {
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
