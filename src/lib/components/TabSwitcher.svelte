<script lang="ts">
  import { join } from '@tauri-apps/api/path'
  import { normalizePath } from '$lib/services/pathService'
  import { isMapsSymlinked } from '$lib/stores/globalPathsStore'
  import { setPath } from '$lib/stores/explorerStore'
  import { handleError } from '$lib/utils/errorHandler'

  export let currentPath: string = ''
  export let baseFolder: string = ''

  $: normalizedCurrentPath = normalizePath(currentPath)

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

  async function handleSwitchTab(subfolder: string) {
    if (!baseFolder || baseFolder.startsWith('/error')) {
      handleError('Base path not initialized', 'Switch Tab')
      return
    }
    try {
      const newAbsolutePath = normalizePath(await join(baseFolder, subfolder))
      await setPath(newAbsolutePath)
    } catch (error) {
      handleError(error, 'Switching tab')
    }
  }
</script>

<section>
  <div
    class="bg-base-200 rounded-box z-10 flex w-64 flex-col items-center space-y-1 p-2 shadow-md"
  >
    {#each tabs as tab (tab.subfolder)}
      {@const expectedPath = normalizePath(`${baseFolder}/${tab.subfolder}`)}
      {@const isActive = normalizedCurrentPath === expectedPath}

      <button
        type="button"
        class="btn btn-ghost h-auto w-full justify-between p-2"
        class:btn-active={isActive}
        class:bg-primary={isActive}
        class:text-primary-content={isActive}
        on:click={() => handleSwitchTab(tab.subfolder)}
        title={tab.label}
      >
        <span class="flex items-center gap-2 text-lg">
          {@html tab.icon}
          <span class="text-sm font-medium normal-case">{tab.label}</span>
        </span>

        {#if tab.subfolder === 'Maps' && $isMapsSymlinked}
          <svg
            class="text-info h-4 w-4"
            viewBox="0 0 16 16"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M7.0503 1.5355c0.9832-0.9832 2.3167-1.5355 3.7072-1.5355 2.8954 0 5.2426 2.3472 5.2426 5.2426 0 1.3904-0.5523 2.7238-1.5355 3.7071l-2.0503 2.0503L11 9.5858l2.0503-2.0503c0.6081-0.6081 1-1.4329 1-2.2929 0-1.7909-1.4518-3.2426-3.2426-3.2426-0.86 0-1.6848 0.3416-2.2929 0.9497L6.4142 5 5 3.5858l2.0503-2.0503Z"
            />
            <path
              d="M7.5355 13.0503l2.0503-2.0503L11 12.4142l-2.0503 2.0503c-0.9832 0.9832-2.3166 1.5355-3.7071 1.5355C2.3472 16 0 13.6528 0 10.7574 0 9.3669 0.5523 8.0334 1.5355 7.0503L3.5858 5 5 6.4142 2.9497 8.4645c-0.6081 0.6081-1 1.4329-1 2.2929 0 1.7909 1.4518 3.2426 3.2426 3.2426 0.86 0 1.6848-0.3416 2.2929-0.9497Z"
            />
            <path
              d="M5.7071 11.7071L11.7071 5.7071 10.2929 4.2929 4.2929 10.2929 5.7071 11.7071Z"
            />
          </svg>
        {/if}
      </button>
    {/each}
  </div>
</section>
