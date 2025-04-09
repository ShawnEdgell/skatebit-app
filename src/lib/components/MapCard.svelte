<!-- src/lib/components/MapCard.svelte -->
<script lang="ts">
  import type { Mod } from '$lib/types/modio';
  export let mod: Mod;
  
  // Helper to format a file size (in bytes) to a human-readable string.
  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
</script>

<div role="listitem" class="relative rounded-lg card shadow-md overflow-hidden flex-shrink-0 group aspect-video bg-base-200 w-80">
  {#if mod.logo?.thumb_320x180}
    <img src={mod.logo.thumb_320x180} alt="{mod.name} thumbnail" class="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" loading="lazy" draggable="false" />
  {:else}
    <div class="absolute inset-0 grid place-content-center bg-base-300 text-base-content/50 text-sm">
      No Image
    </div>
  {/if}

  <!-- File size badge -->
  {#if mod.modfile?.filesize}
    <span class="absolute top-1 right-1 bg-black/50 text-white text-xs rounded px-2 py-1">
      {formatFileSize(mod.modfile.filesize)}
    </span>
  {/if}

  <div class="absolute bottom-0 z-10 w-full p-3 bg-gradient-to-t from-black/60 to-transparent pointer-events-none">
    <span class="font-semibold text-lg text-white drop-shadow-md line-clamp-2">
      {mod.name ?? 'Untitled Mod'}
    </span>
  </div>
  
  <div class="absolute inset-0 z-20 flex items-center justify-center gap-3 bg-neutral/70 opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none">
    <a href={mod.profile_url} target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm pointer-events-auto" title="View on Mod.io" on:click|stopPropagation>
      View Details
    </a>
    {#if mod.modfile?.download?.binary_url}
      <a href={mod.modfile.download.binary_url} download class="btn btn-primary btn-sm pointer-events-auto" title="Download Mod" on:click|stopPropagation>
        Download
      </a>
    {:else}
      <span class="badge badge-sm badge-error pointer-events-auto opacity-80">
        No file
      </span>
    {/if}
  </div>
</div>
