<script lang="ts">
  import { normalizePath } from '$lib/ts/pathUtils';

  export let tabs: { label: string; subfolder: string; icon: string }[] = [];
  export let currentPath: string;
  export let onSwitchTab: (subfolder: string) => void;
  export let baseFolder: string;

  $: normalizedCurrentPath = currentPath ? normalizePath(currentPath) : '';
</script>

<!-- Dock Style Tab Switcher -->
<div class="flex flex-col bg-base-200">
  {#each tabs as tab (tab.subfolder)}
    {@const expectedPath = normalizePath(`${baseFolder}/${tab.subfolder}`)}
    {@const isActive = normalizedCurrentPath === expectedPath}
    <button
      class={`flex flex-col items-center justify-center cursor-pointer text-xs w-32 h-17 ${isActive ? 'bg-primary/30' : 'hover:bg-base-300'}`}
      on:click={() => onSwitchTab(tab.subfolder)}
    >
    <div class="text-lg">
      {@html tab.icon}
    </div>
    <span class="dock-label mt-1">{tab.label}</span>
    </button>
  {/each}
</div>