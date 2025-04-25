<script lang="ts">
  import { join } from '@tauri-apps/api/path'
  import { normalizePath } from '$lib/services/pathService'
  import { isMapsSymlinked } from '$lib/stores/globalPathsStore'
  import { setPath } from '$lib/stores/explorerStore'
  import { handleError } from '$lib/utils/errorHandler'
  import type { ComponentType, SvelteComponent } from 'svelte'

  import {
    MapPin,
    Shirt,
    Palette,
    BarChart2,
    PersonStanding,
    Sparkles,
    Bone,
    Footprints,
    Link, // <-- Import the Link icon
  } from 'lucide-svelte'

  export let currentPath: string = ''
  export let baseFolder: string = ''

  $: normalizedCurrentPath = normalizePath(currentPath)

  interface TabInfo {
    label: string
    subfolder: string
    icon: ComponentType<SvelteComponent>
  }

  const tabs: TabInfo[] = [
    { label: 'Maps', subfolder: 'Maps', icon: MapPin },
    { label: 'Gear', subfolder: 'Gear', icon: Shirt },
    {
      label: 'XLGM Assets',
      subfolder: 'XLGearModifier/Asset Packs',
      icon: Palette,
    },
    { label: 'Stats', subfolder: 'XXLMod3/StatsCollections', icon: BarChart2 },
    {
      label: 'Stance',
      subfolder: 'XXLMod3/StanceCollections',
      icon: PersonStanding,
    },
    { label: 'Steeze', subfolder: 'XXLMod3/SteezeCollections', icon: Sparkles },
    { label: 'BonedOllieMod', subfolder: 'BonedOllieMod', icon: Bone },
    {
      label: 'Walking Mod',
      subfolder: 'walking-mod/animations',
      icon: Footprints,
    },
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
    class="bg-base-200 rounded-box z-10 flex w-64 flex-col items-start space-y-1 p-2 shadow-md"
  >
    {#each tabs as tab (tab.subfolder)}
      {@const expectedPath = normalizePath(`${baseFolder}/${tab.subfolder}`)}
      {@const isActive = normalizedCurrentPath === expectedPath}

      <button
        type="button"
        class="btn btn-ghost h-auto w-full justify-between p-3 text-left"
        class:btn-active={isActive}
        class:bg-primary={isActive}
        class:text-primary-content={isActive}
        on:click={() => handleSwitchTab(tab.subfolder)}
        title={tab.label}
      >
        <span class="flex items-center gap-2">
          <svelte:component this={tab.icon} size={16} class="flex-shrink-0" />
          <span class="text-sm font-medium normal-case">{tab.label}</span>
        </span>

        {#if tab.subfolder === 'Maps' && $isMapsSymlinked}
          <Link
            class="text-info h-4 w-4 flex-shrink-0"
            stroke-width={2}
            aria-hidden="true"
          />
        {/if}
      </button>
    {/each}
  </div>
</section>
