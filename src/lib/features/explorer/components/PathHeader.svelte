<!-- src/lib/components/PathHeader.svelte -->
<script lang="ts">
  import { normalizePath } from '$lib/ts/pathUtils';
  export let currentPath: string;
  export let baseFolder: string; // Should be "Documents/SkaterXL"
  export let onGoBack: () => void;
  
  // Normalize both the current path and the base folder for a consistent check.
  $: normalizedPath = normalizePath(currentPath);
  $: mainDir = normalizePath(baseFolder);
  
  // Optionally log to check the values during development.
  // console.log("MainDir:", mainDir, "CurrentPath:", normalizedPath);
</script>

<div class="flex items-center space-x-2">
  <button
    class="btn btn-soft btn-xs"
    on:click={onGoBack}
    disabled={normalizedPath === mainDir}>
    Go Back
  </button>

  <nav class="flex items-center" aria-label="Breadcrumb">
      <span class="text-xl text-info mx-1 mr-">📁</span>
    {#each normalizedPath.split('/') as crumb, index}
      <span class="text-lg font-semibold">{crumb}</span>
      {#if index < normalizedPath.split('/').length - 1}
        <span class="mx-1">/</span>
      {/if}
    {/each}
  </nav>
</div>
