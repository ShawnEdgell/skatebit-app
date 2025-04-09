<script lang="ts">
  import type { LocalMapEntry } from "$lib/ts/fsOperations";
  import GenericCard from "$lib/components/GenericCard.svelte";
  import { documentDir, join } from "@tauri-apps/api/path";
  import { readFile, BaseDirectory } from "@tauri-apps/plugin-fs";
  import { revealItemInDir } from "@tauri-apps/plugin-opener";
  import { deleteEntry, baseFolder } from "$lib/ts/fsOperations";
  import { normalizePath } from "$lib/ts/pathUtils";
  import { createEventDispatcher, onDestroy, onMount } from "svelte";

  export let localMap: LocalMapEntry;
  const dispatch = createEventDispatcher();

  const relativeMapsFolder = normalizePath(`${baseFolder}/Maps`);

  let blobUrl = "";
  let isLoadingUrl = false;
  let observer: IntersectionObserver;
  let cardElement: HTMLElement;

  // Flag to ensure we load once only
  let hasLoaded = false;

  async function loadImageData(relativePath: string | undefined, mimeType: string | undefined) {
    if (blobUrl && blobUrl.startsWith("blob:")) {
      URL.revokeObjectURL(blobUrl);
      blobUrl = "";
    }
    if (!relativePath || !mimeType) return;
    isLoadingUrl = true;
    try {
      const binaryData: Uint8Array = await readFile(relativePath, { baseDir: BaseDirectory.Document });
      const blob = new Blob([binaryData], { type: mimeType });
      blobUrl = URL.createObjectURL(blob);
    } catch (err) {
      console.error(`Failed to load image ${relativePath}:`, err);
      blobUrl = "";
    } finally {
      isLoadingUrl = false;
    }
  }

  // Use IntersectionObserver to lazy-load the image only when in view.
  onMount(() => {
    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !hasLoaded) {
          // Only load the image once the card is visible.
          loadImageData(localMap.thumbnailPath, localMap.thumbnailMimeType);
          hasLoaded = true;
          observer.unobserve(entry.target);
        }
      });
    });
    if (cardElement) {
      observer.observe(cardElement);
    }
    return () => {
      observer && observer.disconnect();
    };
  });

  onDestroy(() => {
    if (blobUrl && blobUrl.startsWith("blob:")) {
      URL.revokeObjectURL(blobUrl);
    }
  });

  function formatFileSize(bytes: number | undefined): string {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = bytes > 0 ? Math.floor(Math.log(bytes) / Math.log(k)) : 0;
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  let deleteInProgress = false;

  async function openInExplorer(e: MouseEvent) {
    try {
      const fullPathToReveal = await join(
        await documentDir(),
        relativeMapsFolder,
        localMap.name
      );
      await revealItemInDir(fullPathToReveal);
    } catch (error) {
      console.error("Error using opener plugin:", error);
    }
  }

  async function handleDelete(e: MouseEvent) {
    if (deleteInProgress) return;
    deleteInProgress = true;
    try {
      const deleted = await deleteEntry(relativeMapsFolder, localMap.name);
      if (deleted) {
        dispatch("deleted", { name: localMap.name });
      }
    } catch (error) {
      console.error("Error deleting local map:", error);
    } finally {
      deleteInProgress = false;
    }
  }
</script>

<!-- Bind the outer div element to enable IntersectionObserver -->
<div bind:this={cardElement} class="relative flex-shrink-0 w-80 aspect-video">
  <GenericCard
    imageUrl={blobUrl}
    fallbackIcon={localMap.isDirectory ? "📁" : "📄"}
    badgeText={!localMap.isDirectory ? formatFileSize(localMap.size) : ""}
    title={localMap.name}>
    <span slot="overlay">
      <button class="btn btn-secondary btn-sm pointer-events-auto"
        on:click|preventDefault|stopPropagation={openInExplorer}
        title="Open in File Explorer">
        Open
      </button>
      <button class="btn btn-error btn-sm pointer-events-auto"
        on:click|preventDefault|stopPropagation={handleDelete}
        title="Delete Local Map"
        disabled={deleteInProgress}>
        {#if deleteInProgress}
          <span class="loading loading-spinner loading-xs"></span>
        {:else}
          Delete
        {/if}
      </button>
    </span>
  </GenericCard>

  {#if isLoadingUrl}
    <div class="absolute inset-0 grid place-content-center bg-base-300/50 z-30 rounded-lg">
      <span class="loading loading-spinner loading-sm"></span>
    </div>
  {/if}
</div>
