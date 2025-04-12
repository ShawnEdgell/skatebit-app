<!-- src/lib/components/PathHeader.svelte -->
<script lang="ts">
  import { normalizePath } from '$lib/ts/pathUtils';
  import { get, writable } from 'svelte/store'; // Import writable
  import { explorerStore } from '$lib/stores/explorerStore';
  // Import documentDir or get it from a shared store/context
  import { documentDir, normalize } from '@tauri-apps/api/path';
  import { onMount } from 'svelte'; // Import onMount

  export let currentPath: string | undefined | null = ""; // Absolute path
  export let onGoBack: () => void;

  // State to hold the Documents directory path
  const documentDirPath = writable<string>('');
  // State to hold the absolute base folder path (for disabling back button)
  const absoluteBaseFolderPath = writable<string>('');

  onMount(async () => {
      try {
          const docDir = normalizePath(await normalize(await documentDir()));
          documentDirPath.set(docDir);
          // Get base folder path from explorerStore after it initializes
          // Note: This relies on explorerStore exposing this getter function reliably
          const absBase = explorerStore.absoluteBaseFolderPath ? explorerStore.absoluteBaseFolderPath() : '';
          absoluteBaseFolderPath.set(normalizePath(absBase));

          // Log paths after initialization
          console.log("PathHeader Initialized: DocDir=", $documentDirPath, "AbsBase=", $absoluteBaseFolderPath);

      } catch (e) {
          console.error("PathHeader: Failed to get paths on mount", e);
          documentDirPath.set("/error/docdir");
          absoluteBaseFolderPath.set("/error/basepath");
      }
  });

  // Calculate display segments based on path relative to Documents
  let displayPathSegments: string[] = [];
  $: {
      const normCurrent = currentPath ? normalizePath(currentPath) : '';
      const normDocDir = $documentDirPath ? normalizePath($documentDirPath) : '';

      if (normCurrent && normDocDir && normCurrent.startsWith(normDocDir)) {
          // Get path relative to Documents directory
          let relativeToDocs = normCurrent.substring(normDocDir.length).replace(/^[\/\\]/, ''); // Remove leading slash
          // Get the name of the Documents directory itself
          const docDirName = normDocDir.split(/[\\/]/).pop() || 'Documents';
          // Create segments starting with "Documents"
          displayPathSegments = relativeToDocs ? [docDirName, ...relativeToDocs.split('/')] : [docDirName];
      } else if (normCurrent) {
           // Fallback if outside Documents (or error): Show absolute path segments (no drive letter)
           const parts = normCurrent.split(/[\\/]/);
           displayPathSegments = parts[0].endsWith(':') ? parts.slice(1).filter(s => s !== '') : parts.filter(s => s !== ''); // Try to remove drive letter C:
      } else {
          displayPathSegments = ['Loading...']; // Initial state
      }
       // console.log("Display Segments:", displayPathSegments); // Debug log
  }

  // Disable logic compares absolute paths
  $: canGoBack = currentPath && $absoluteBaseFolderPath && normalizePath(currentPath) !== $absoluteBaseFolderPath;

</script>

<div class="flex items-center space-x-2 text-sm" title={currentPath ?? ''}>
  <button
    class="btn btn-ghost btn-xs flex-shrink-0 px-2 disabled:opacity-50" 
    on:click={onGoBack}
    disabled={!canGoBack}
    title="Go up one level"
    aria-label="Go up one level"
  >
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 9l6-6m0 0l6 6m-6-6v12a6 6 0 01-12 0v-3" />
    </svg>
  </button>

  <div class="flex items-center overflow-hidden text-ellipsis whitespace-nowrap" aria-label="Breadcrumb">
    {#each displayPathSegments as crumb, index (crumb + index)}
      {#if index > 0}
        <span class="mx-1 text-base-content/50 flex-shrink-0">/</span> 
      {/if}
      <span class:font-semibold={index === displayPathSegments.length - 1} class="text-base-content">{@html crumb}</span>
    {/each}
  </div>
</div>