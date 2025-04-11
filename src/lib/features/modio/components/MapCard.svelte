<script lang="ts">
  import type { Mod } from '$lib/types/modio';
  // Create a local type extension so that we can use the extra property.
  type ExtendedMod = Mod & { imageUrl?: string };

  export let mod: ExtendedMod;
  
  import { invoke } from '@tauri-apps/api/core';
  import { refreshLocalMaps } from '$lib/stores/localMapsStore';
  import { handleError, handleSuccess } from '$lib/ts/errorHandler';
  
  // Helper function to format file sizes.
  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  // Local state to track if installation is in progress.
  let isInstalling = false;
  
  async function handleDownload() {
    console.log("Install button clicked");
    isInstalling = true;
    try {
      await invoke("download_and_install", {
        url: mod.modfile.download.binary_url,
        destination: "SkaterXL/Maps"  // Optionally append a folder like `SkaterXL/Maps/${mod.id}`
      });
      console.log("Download and install completed successfully.");
      // Refresh the local maps list.
      await refreshLocalMaps();
      handleSuccess("Map installed successfully", "Installation");
    } catch (error) {
      handleError(error, "Installation");
    } finally {
      isInstalling = false;
    }
  }
</script>

<div role="listitem" class="relative rounded-lg card shadow-md overflow-hidden flex-shrink-0 group aspect-video bg-base-200 h-45">
  {#if mod.imageUrl}
    <img src={mod.imageUrl} alt="{mod.name} thumbnail" class="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" loading="lazy" draggable="false" />
  {:else if mod.logo?.thumb_320x180}
    <img src={mod.logo.thumb_320x180} alt="{mod.name} thumbnail" class="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" loading="lazy" draggable="false" />
  {:else}
    <div class="absolute inset-0 grid place-content-center bg-base-300 text-base-content/50 text-sm">
      No Image
    </div>
  {/if}

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
      <button on:click|stopPropagation={handleDownload} disabled={isInstalling} class="btn btn-primary btn-sm pointer-events-auto" title="Install Mod">
        {#if isInstalling}
          <span class="loading loading-spinner loading-sm"></span>
          Installing...
        {:else}
          Install
        {/if}
      </button>
    {:else}
      <span class="badge badge-sm badge-error pointer-events-auto opacity-80">No file</span>
    {/if}
  </div>
</div>