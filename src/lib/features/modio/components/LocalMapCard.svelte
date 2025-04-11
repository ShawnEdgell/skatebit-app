<!-- src/lib/components/LocalMapCard.svelte -->
<script lang="ts">
  import type { LocalMapEntry } from "$lib/ts/fsOperations";
  import GenericCard from "./GenericCard.svelte";
  import { documentDir, join } from "@tauri-apps/api/path";
  import { readFile, BaseDirectory } from "@tauri-apps/plugin-fs";
  import { revealItemInDir } from "@tauri-apps/plugin-opener";
  import { baseFolder } from "$lib/ts/fsOperations";
  import { normalizePath } from "$lib/ts/pathUtils";
  import { createEventDispatcher, onDestroy, onMount } from "svelte";

  export let localMap: LocalMapEntry;
  const dispatch = createEventDispatcher();

  // Build the relative maps folder (this should match your folder structure)
  const relativeMapsFolder = normalizePath(`${baseFolder}/Maps`);

  let blobUrl = "";
  let isLoadingUrl = false;
  let observer: IntersectionObserver;
  let cardElement: HTMLElement;
  let hasLoaded = false;

  async function loadImageData(relativePath: string | undefined, mimeType: string | undefined) {
    console.log("Attempting to load image from path:", relativePath);
    if (blobUrl && blobUrl.startsWith("blob:")) {
      URL.revokeObjectURL(blobUrl);
      blobUrl = "";
    }
    if (!relativePath || !mimeType) return;
    isLoadingUrl = true;
    try {
      // Using readFile with baseDir: Document to read the file from Documents\<relativeMapsFolder>
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

  onMount(() => {
    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !hasLoaded) {
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

  async function openInExplorer(e: MouseEvent) {
    try {
      const docDir = await documentDir();
      // Build full path using Tauri's join
      const fullPathToReveal = normalizePath(await join(docDir, relativeMapsFolder, localMap.name));
      console.log("Opening file explorer at:", fullPathToReveal);
      await revealItemInDir(fullPathToReveal);
    } catch (error) {
      console.error("Error using opener plugin:", error);
    }
  }

  // Instead of deleting immediately, dispatch a custom "requestDelete" event
  function triggerDelete(e: MouseEvent) {
    e.stopPropagation();
    dispatch("requestDelete", { name: localMap.name });
  }
</script>

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
        on:click|preventDefault|stopPropagation={triggerDelete}
        title="Delete Local Map">
        Delete
      </button>
    </span>
  </GenericCard>

  {#if isLoadingUrl}
    <div class="absolute inset-0 grid place-content-center bg-base-300/50 z-30 rounded-lg">
      <span class="loading loading-spinner loading-sm"></span>
    </div>
  {/if}
</div>