<script lang="ts">
  import { browser } from '$app/environment'
  import { onDestroy } from 'svelte'
  import { page } from '$app/stores'
  import { join } from '@tauri-apps/api/path'
  import { normalizePath } from '$lib/services/pathService'
  import { handleError } from '$lib/utils/errorHandler'
  import { uploadFilesToCurrentPath } from '$lib/utils/useFileUpload'

  import {
    currentPath,
    entries,
    isLoading,
    refresh,
  } from '$lib/stores/explorerStore'
  import { explorerDirectory } from '$lib/stores/globalPathsStore'
  import { activeDropTargetInfo } from '$lib/stores/dndStore'

  import TabSwitcher from '$lib/components/TabSwitcher.svelte'
  import FileList from '$lib/components/FileList.svelte'
  import PathHeader from '$lib/components/PathHeader.svelte'
  import FileActions from '$lib/components/FileActions.svelte'

  const tabs = [
    { label: 'Maps', subfolder: 'Maps', icon: '🗺️' },
    { label: 'Gear', subfolder: 'Gear', icon: '🧢' },
    {
      label: 'XLGM Assets',
      subfolder: 'XLGearModifier/Asset Packs',
      icon: '🎨',
    },
    { label: 'Stats', subfolder: 'XXLMod3/StatsCollections', icon: '📊' },
    { label: 'Stance', subfolder: 'XXLMod3/StanceCollections', icon: '🧍' },
    { label: 'Steeze', subfolder: 'XXLMod3/SteezeCollections', icon: '🛹' },
    { label: 'BonedOllieMod', subfolder: 'BonedOllieMod', icon: '🦴' },
    { label: 'Walking Mod', subfolder: 'walking-mod/animations', icon: '🚶' },
  ]

  let fileInput: HTMLInputElement

  async function handleFileChange(e: Event) {
    const target = e.target as HTMLInputElement
    if (!$currentPath) {
      handleError('Cannot upload: Invalid path.', 'Upload')
      return
    }
    await uploadFilesToCurrentPath(target.files, $currentPath, async () => {
      target.value = ''
      await refresh()
    })
  }

  function triggerUpload() {
    fileInput.click()
  }

  $: if (browser && $page.url.pathname === '/') {
    activeDropTargetInfo.set({
      path: $currentPath,
      label: 'Current Folder',
    })
  }

  onDestroy(() => {
    activeDropTargetInfo.set({ path: null, label: null })
  })

  async function openDir(folderName: string) {
    if (!$currentPath) return
    const newAbs = normalizePath(await join($currentPath, folderName))
    explorerDirectory.set(newAbs)
  }
</script>

<div class="bg-base-300 flex h-full w-full">
  <div class="flex w-full flex-1 flex-col gap-4 overflow-hidden px-4 pb-4">
    <div
      class="bg-base-100 rounded-box flex w-full items-center justify-between p-2 shadow-md"
    >
      <div class="mr-4 min-w-0 flex-grow overflow-hidden">
        <PathHeader
          currentPath={$currentPath}
          absoluteBasePath={$explorerDirectory}
        />
      </div>
      <div class="flex-shrink-0">
        <FileActions on:upload={triggerUpload} />
      </div>
    </div>

    <div class="mb-16.5 flex h-full w-full gap-4 overflow-hidden">
      <TabSwitcher
        {tabs}
        currentPath={$currentPath}
        baseFolder={$explorerDirectory}
      />

      <div
        class="rounded-box bg-base-100 relative h-full min-h-0 w-full overflow-y-auto p-2 shadow-md"
      >
        <FileList
          loading={$isLoading && $entries.length > 0}
          on:openDir={(e) => openDir(e.detail)}
        />
      </div>
    </div>
  </div>

  <input
    type="file"
    multiple
    bind:this={fileInput}
    on:change={handleFileChange}
    class="hidden"
  />
</div>
