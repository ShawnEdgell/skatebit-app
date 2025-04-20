<script lang="ts">
  import { uploadFilesToCurrentPath } from '$lib/utils/useFileUpload'
  import { explorerDirectory } from '$lib/stores/globalPathsStore'
  import {
    currentPath,
    entries,
    isLoading,
    refreshExplorer,
  } from '$lib/stores/explorerStore'
  import { handleError } from '$lib/utils/errorHandler'

  import TabSwitcher from '$lib/components/TabSwitcher.svelte'
  import FileList from '$lib/components/FileList.svelte'
  import PathHeader from '$lib/components/PathHeader.svelte'
  import FileActions from '$lib/components/FileActions.svelte'

  // static tab definitions
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

  async function handleFileChange(event: Event) {
    const target = event.target as HTMLInputElement
    const files = target?.files
    if (!$currentPath || $currentPath.startsWith('/error')) {
      handleError('Cannot upload: Current path is invalid.', 'Upload')
      return
    }
    await uploadFilesToCurrentPath(files, $currentPath, async () => {
      await refreshExplorer()
      if (target) target.value = ''
    })
  }

  function triggerUpload() {
    fileInput?.click()
  }
</script>

<div class="bg-base-300 flex h-full w-full">
  <div class="flex w-full flex-1 flex-col gap-4 overflow-hidden px-4 pb-4">
    <!-- header row -->
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

    <!-- body: tabs + file list -->
    <div class="mb-16.5 flex h-full w-full gap-4 overflow-hidden">
      <TabSwitcher
        {tabs}
        currentPath={$currentPath}
        baseFolder={$explorerDirectory}
      />

      <div
        class="rounded-box bg-base-100 relative h-full min-h-0 w-full overflow-y-auto p-2 shadow-md"
      >
        {#if $isLoading && $entries.length === 0}
          <div
            class="bg-base-100/50 absolute inset-0 z-10 flex items-center justify-center p-4"
          >
            <span class="loading loading-spinner loading-lg"></span>
          </div>
        {:else}
          {#key $currentPath}
            <FileList loading={$isLoading && $entries.length > 0} />
          {/key}
        {/if}
      </div>
    </div>
  </div>

  <!-- hidden file input for FileActions -->
  <input
    type="file"
    multiple
    bind:this={fileInput}
    on:change={handleFileChange}
    class="hidden"
  />
</div>
