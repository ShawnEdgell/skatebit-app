<!-- src/lib/components/MapCard.svelte -->
<script lang="ts">
  import type { Mod } from '$lib/types/modio';
  import GenericCard from '$lib/components/GenericCard.svelte';

  export let mod: Mod;

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
</script>

<GenericCard
  imageUrl={mod.logo?.thumb_320x180}
  fallbackIcon="No Image"
  badgeText={mod.modfile?.filesize ? formatFileSize(mod.modfile.filesize) : ''}
  title={mod.name ?? 'Untitled Mod'}
>
  <span slot="overlay">
    <a
      href={mod.profile_url}
      target="_blank"
      rel="noopener noreferrer"
      class="btn btn-secondary btn-sm pointer-events-auto"
      title="View on Mod.io"
      on:click|stopPropagation
    >
      View Details
    </a>
    {#if mod.modfile?.download?.binary_url}
      <a
        href={mod.modfile.download.binary_url}
        download
        class="btn btn-primary btn-sm pointer-events-auto"
        title="Download Mod"
        on:click|stopPropagation
      >
        Download
      </a>
    {:else}
      <span class="badge badge-sm badge-error pointer-events-auto opacity-80">
        No file
      </span>
    {/if}
  </span>
</GenericCard>
