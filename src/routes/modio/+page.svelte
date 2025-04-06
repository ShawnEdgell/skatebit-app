<script lang="ts">
  import type { ModsData } from '$lib/types/modio';
  import TabSwitcher from '$lib/components/TabSwitcher.svelte';

  // "modsData" is passed as a prop from the load function.
  export let data: { modsData: ModsData };
  const { gearMods, mapMods, scriptMods } = data.modsData;

  // Define the tabs for switching
  const tabs = [
    { label: 'Maps', subfolder: 'maps' },
    { label: 'Gear', subfolder: 'gear' },
    { label: 'Scripts', subfolder: 'scripts' }
  ];

  // Default current tab is "maps"
  let currentTab = 'maps';

  // Base folder (adjust as needed)
  const baseFolder = '/mods';

  // Called when a tab is switched
  function onSwitchTab(subfolder: string) {
    currentTab = subfolder;
  }
</script>

<div class="container mx-auto ">
  <!-- Tab Switcher -->
  <TabSwitcher
    {tabs}
    currentPath={`${baseFolder}/${currentTab}`}
    {baseFolder}
    onSwitchTab={onSwitchTab} />

  {#if currentTab === 'maps'}
    <!-- Map Mods Section -->
    <section>
      <h3>Latest Maps</h3>
      {#if mapMods && mapMods.length > 0}
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {#each mapMods as mod}
            <div class="card not-prose bg-base-200 rounded shadow overflow-hidden flex flex-col">
              <img
                src={mod.logo.thumb_320x180}
                alt="{mod.name} thumbnail"
                class="w-full object-cover" />
              <div class="p-4 flex flex-col flex-1 justify-between">
                <a
                  class="font-semibold text-lg hover:underline"
                  href={mod.profile_url}
                  target="_blank"
                  rel="noopener noreferrer">
                  {mod.name}
                </a>
                <a
                  href={mod.modfile.download.binary_url}
                  class="btn btn-sm btn-primary mt-4 w-full"
                  target="_blank"
                  rel="noopener noreferrer">
                  Download
                </a>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <p class="text-center">No map mods found.</p>
      {/if}
    </section>
  {:else if currentTab === 'gear'}
    <!-- Gear Mods Section -->
    <section>
      <h3>Latest Gear</h3>
      {#if gearMods && gearMods.length > 0}
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {#each gearMods as mod}
            <div class="card not-prose bg-base-200 rounded shadow overflow-hidden flex flex-col">
              <img
                src={mod.logo.thumb_320x180}
                alt="{mod.name} thumbnail"
                class="w-full object-cover" />
              <div class="p-4 flex flex-col flex-1 justify-between">
                <a
                  class="font-semibold text-lg hover:underline"
                  href={mod.profile_url}
                  target="_blank"
                  rel="noopener noreferrer">
                  {mod.name}
                </a>
                <a
                  href={mod.modfile.download.binary_url}
                  class="btn btn-sm btn-primary mt-4 w-full"
                  target="_blank"
                  rel="noopener noreferrer">
                  Download
                </a>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <p class="text-center">No gear mods found.</p>
      {/if}
    </section>
  {:else if currentTab === 'scripts'}
    <!-- Script Mods Section -->
    <section>
      <h3>Latest Scripts</h3>
      {#if scriptMods && scriptMods.length > 0}
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {#each scriptMods as mod}
            <div class="card not-prose bg-base-200 rounded shadow overflow-hidden flex flex-col">
              <img
                src={mod.logo.thumb_320x180}
                alt="{mod.name} thumbnail"
                class="w-full object-cover" />
              <div class="p-4 flex flex-col flex-1 justify-between">
                <a
                  class="font-semibold text-lg hover:underline"
                  href={mod.profile_url}
                  target="_blank"
                  rel="noopener noreferrer">
                  {mod.name}
                </a>
                <a
                  href={mod.modfile.download.binary_url}
                  class="btn btn-sm btn-primary mt-4 w-full"
                  target="_blank"
                  rel="noopener noreferrer">
                  Download
                </a>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <p class="text-center">No script mods found.</p>
      {/if}
    </section>
  {/if}
</div>
