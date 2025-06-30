<script lang="ts">
  import { join } from '@tauri-apps/api/path'
  import { normalizePath } from '$lib/services/pathService'
  import { isMapsSymlinked } from '$lib/stores/globalPathsStore'
  import { setPath } from '$lib/stores/explorerStore'
  import { handleError } from '$lib/utils/errorHandler'
  import type { SvelteComponent } from 'svelte'
  import {
    MapPin,
    Shirt,
    Layers2,
    BarChart2,
    User,
    Activity,
    Bone,
    Footprints,
    Link2,
  } from 'lucide-svelte'

  export let currentPath = ''
  export let baseFolder = ''

  $: normalizedCurrentPath = normalizePath(currentPath)

  interface Tab {
    label: string
    subfolder: string
    Icon: typeof SvelteComponent
    showLinkIndicator?: boolean
  }

  const tabs: Tab[] = [
    { label: 'Maps', subfolder: 'Maps', Icon: MapPin, showLinkIndicator: true },
    { label: 'Gear', subfolder: 'Gear', Icon: Shirt },
    {
      label: 'XLGM Assets',
      subfolder: 'XLGearModifier/Asset Packs',
      Icon: Layers2,
    },
    { label: 'Stats', subfolder: 'XXLMod3/StatsCollections', Icon: BarChart2 },
    { label: 'Stance', subfolder: 'XXLMod3/StanceCollections', Icon: User },
    { label: 'Steeze', subfolder: 'XXLMod3/SteezeCollections', Icon: Activity },
    { label: 'BonedOllieMod', subfolder: 'BonedOllieMod', Icon: Bone },
    {
      label: 'Walking Mod',
      subfolder: 'walking-mod/animations',
      Icon: Footprints,
    },
  ]

  async function handleSwitchTab(subfolder: string) {
    if (!baseFolder || baseFolder.startsWith('/error')) {
      return handleError('Base path not initialized', 'Switch Tab')
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
    class="bg-base-200 h-full rounded-box z-10 flex w-54 flex-col items-center space-y-1 p-2 shadow-md"
  >
    {#each tabs as tab}
      {@const expectedPath = normalizePath(`${baseFolder}/${tab.subfolder}`)}
      {@const isActive = normalizedCurrentPath === expectedPath}

      <button
        type="button"
        class="btn btn-ghost h-auto w-full justify-between p-3"
        class:btn-active={isActive}
        class:bg-primary={isActive}
        class:text-primary-content={isActive}
        on:click={() => handleSwitchTab(tab.subfolder)}
        title={tab.label}
      >
        <span class="flex items-center gap-2 text-lg">
          <svelte:component this={tab.Icon} class="h-5 w-5" />
          <span class="text-xs">{tab.label}</span>
        </span>

        {#if tab.showLinkIndicator && $isMapsSymlinked}
          <Link2 class="text-info h-4 w-4" />
        {/if}
      </button>
    {/each}
  </div>
</section>
