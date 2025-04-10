<script lang="ts">
  import { normalizePath } from '$lib/ts/pathUtils';

  export let tabs: { label: string; subfolder: string }[] = [];
  export let currentPath: string;
  export let onSwitchTab: (subfolder: string) => void;
  export let baseFolder: string;

  $: normalizedCurrentPath = currentPath ? normalizePath(currentPath) : '';
</script>

<div class="mb-4 flex items-center gap-2 flex-wrap" role="tablist" aria-label="File Manager Tabs">
  <h2 class="text-2xl mr-2 font-bold">File Manager</h2>
  {#each tabs as tab (tab.subfolder)}
    {@const expectedPath = normalizePath(`${baseFolder}/${tab.subfolder}`)}
    {@const isActive = normalizedCurrentPath === expectedPath}
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      class="badge cursor-pointer transition-colors {isActive ? 'badge-primary' : 'hover:bg-base-content hover:text-base-100'}"
      on:click={() => onSwitchTab(tab.subfolder)}>
      {tab.label}
    </button>
  {/each}
</div>
