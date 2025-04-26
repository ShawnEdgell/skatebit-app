<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { get } from 'svelte/store'
  import { join } from '@tauri-apps/api/path'
  import { normalizePath } from '$lib/services/pathService'
  import { explorerDirectory } from '$lib/stores/globalPathsStore'
  import {
    currentPath as explorerCurrentPath,
    entries,
    isLoading as isExplorerLoading,
    explorerError,
    setPath,
    refresh, // Keep refresh available
  } from '$lib/stores/explorerStore'
  import FileList from '$lib/components/FileList.svelte' // Reuse your existing FileList
  import type { SvelteComponent } from 'svelte'
  import { invoke } from '@tauri-apps/api/core'
  import { handleError } from '$lib/utils/errorHandler'

  type Category = {
    key: string
    name: string
    subfolder: string
    Icon: typeof SvelteComponent
  }

  export let category: Category

  let localPath: string | null = null
  let pathUpdateError: string | null = null
  let calculationComplete = false

  $: if (category) {
    calculateAndSetPath()
  }

  async function calculateAndSetPath() {
    pathUpdateError = null
    calculationComplete = false
    const baseDir = get(explorerDirectory)

    if (!baseDir || baseDir.startsWith('/error')) {
      pathUpdateError = 'Base Skater XL directory is not set or is invalid.'
      localPath = null
      if (get(explorerCurrentPath) !== '/error/basedir') {
        setPath('/error/basedir')
      }
      calculationComplete = true
      return
    }

    if (!category?.subfolder) {
      pathUpdateError = 'Selected category has no subfolder defined.'
      localPath = null
      if (get(explorerCurrentPath) !== '/error/category') {
        setPath('/error/category')
      }
      calculationComplete = true
      return
    }

    try {
      const newLocalPath = normalizePath(
        await join(baseDir, category.subfolder),
      )
      localPath = newLocalPath

      if (newLocalPath !== get(explorerCurrentPath)) {
        await setPath(newLocalPath)
      }
      calculationComplete = true
    } catch (e: any) {
      console.error('Error calculating or setting local path:', e)
      pathUpdateError = `Failed to process path: ${e.message || e}`
      localPath = null
      if (get(explorerCurrentPath) !== '/error/processing') {
        setPath('/error/processing')
      }
      calculationComplete = true
    }
  }

  onMount(() => {
    calculateAndSetPath()
  })

  async function createDirectory() {
    if (!localPath || localPath.startsWith('/error')) {
      console.error('Cannot create directory for invalid path:', localPath)
      return
    }
    try {
      // Ensure create_directory_rust is correctly defined and imported if used
      await invoke('create_directory_rust', { absolutePath: localPath })
      // Path might exist now, refresh the store state
      await refresh() // Refresh after successful creation
    } catch (e) {
      handleError(e, `Failed to create directory ${localPath}`)
    }
  }
</script>

{#if !calculationComplete}
  <div class="flex h-full items-center justify-center p-4">
    <span class="loading loading-spinner loading-lg"></span>
  </div>
{:else if pathUpdateError}
  <div
    class="flex h-full flex-col items-center justify-center gap-4 p-4 text-center"
  >
    <h3 class="text-warning text-lg font-semibold">Path Error</h3>
    <p class="text-base-content/70 w-md">{pathUpdateError}</p>
  </div>
{:else if $explorerError && ($explorerError.includes('os error 2') || $explorerError?.includes('cannot find the path') || $explorerError?.includes('os error 3') || $explorerError?.includes('The system cannot find the path specified'))}
  <div
    class="flex h-full flex-col items-center justify-center gap-4 p-4 text-center"
  >
    <h3 class="text-warning text-lg font-semibold">Folder Not Found</h3>
    <p class="text-base-content/70 w-md">
      The local folder for {category.name} doesn't seem to exist:
    </p>
    <p class="text-base-content/70 bg-base-200 rounded p-2 font-mono text-sm">
      {localPath || 'N/A'}
    </p>
    <p class="text-base-content/70 w-md">{$explorerError}</p>
    {#if localPath && !localPath.startsWith('/error')}
      <button class="btn btn-primary btn-sm" on:click={createDirectory}>
        Create Folder Now
      </button>
    {/if}
  </div>
{:else if $explorerError}
  <div
    class="flex h-full flex-col items-center justify-center gap-4 p-4 text-center"
  >
    <h3 class="text-error text-lg font-semibold">Error Loading Files</h3>
    <p class="text-base-content/70 w-md">
      Could not load local files for {category.name}:
    </p>
    <p class="text-base-content/70 bg-base-200 rounded p-2 font-mono text-sm">
      {localPath || 'N/A'}
    </p>
    <p class="text-base-content/70 w-md">{$explorerError}</p>
    <button class="btn btn-sm" on:click={() => refresh()}>Retry</button>
  </div>
{:else}
  <FileList loading={$isExplorerLoading && $entries.length === 0} />
{/if}
