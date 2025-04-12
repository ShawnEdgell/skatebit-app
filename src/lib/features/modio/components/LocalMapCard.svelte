<!-- src/lib/components/LocalMapCard.svelte -->
<script lang="ts">
  import type { FsEntry } from "$lib/ts/fsOperations";
  import GenericCard from "./GenericCard.svelte";
  import { readFile, exists, BaseDirectory } from "@tauri-apps/plugin-fs";
  import { revealItemInDir } from "@tauri-apps/plugin-opener";
  import { createEventDispatcher, onMount, tick } from "svelte";
  import { formatFileSize } from "$lib/utils/formatter"; // Corrected import path

  export let localMap: FsEntry;
  const dispatch = createEventDispatcher();

  console.log(`[LocalMapCard] Received localMap prop:`, JSON.parse(JSON.stringify(localMap ?? {error: 'localMap prop is null/undefined'})));

  let blobUrl = "";
  let isLoadingUrl = false;
  let observer: IntersectionObserver;
  let cardElement: HTMLElement;
  let isVisible = false;
  let processedThumbnailPath: string | undefined | null = null;
  $: canPerformActions = !!localMap?.path;

  $: if (isVisible && localMap?.relativeThumbnailPath && localMap.relativeThumbnailPath !== processedThumbnailPath && !isLoadingUrl) {
      console.log(`[${localMap.name}] Reactive trigger: Relative thumbnail path available (${localMap.relativeThumbnailPath}), component visible.`);
      tick().then(() => {
          if (isVisible && localMap?.relativeThumbnailPath && localMap.relativeThumbnailPath !== processedThumbnailPath && !isLoadingUrl) {
              loadImageData(
                  localMap.relativeThumbnailPath,
                  localMap.thumbnailMimeType ?? undefined
              );
          }
      });
  }

  $: if (localMap?.name && blobUrl && localMap?.relativeThumbnailPath !== processedThumbnailPath) {
      console.log(`[${localMap.name}] Map data changed (or relativeThumbnailPath changed), resetting blobUrl and processedThumbnailPath.`);
      if (blobUrl && blobUrl.startsWith("blob:")) {
        URL.revokeObjectURL(blobUrl);
      }
      blobUrl = "";
      processedThumbnailPath = null;
      isLoadingUrl = false;
  }

  async function loadImageData(relativePath: string | undefined, mimeType: string | undefined) {
    if (!localMap) {
        console.warn("loadImageData called but localMap is undefined/null.");
        return;
    }
    if (!relativePath || !mimeType) {
      console.warn(`[${localMap.name}] loadImageData called with invalid relative path/mime.`);
      return;
    }
    if (localMap.relativeThumbnailPath !== relativePath) {
        console.warn(`[${localMap.name}] loadImageData called but map's relativeThumbnailPath changed. Aborting load for ${relativePath}`);
        return;
    }
    if (isLoadingUrl) {
        console.warn(`[${localMap.name}] loadImageData called while already loading.`);
        return;
    }

    console.log(`[${localMap.name}] loadImageData: Attempting load for relative path: ${relativePath}`);
    isLoadingUrl = true;
    processedThumbnailPath = relativePath;

    if (blobUrl && blobUrl.startsWith("blob:")) {
        URL.revokeObjectURL(blobUrl);
        blobUrl = "";
    }

    const MAX_RETRIES = 8;
    const INITIAL_DELAY = 300;
    const BACKOFF_FACTOR = 1.5;
    let success = false;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        await tick();
        await new Promise(res => setTimeout(res, 50));

        console.log(`[${localMap.name}] Attempt ${attempt + 1}: Checking existence relative to Documents: ${relativePath}`);
        const fileExists = await exists(relativePath, { baseDir: BaseDirectory.Document });
        console.log(`[${localMap.name}] Exists check for '${relativePath}' (relative to Docs): ${fileExists}`);


        if (fileExists) {
          console.log(`[${localMap.name}] Attempt ${attempt + 1}: File exists, reading...`);
          const binaryData = await readFile(relativePath, { baseDir: BaseDirectory.Document });

          if (cardElement && localMap?.relativeThumbnailPath === relativePath) {
              const blob = new Blob([binaryData], { type: mimeType });
              blobUrl = URL.createObjectURL(blob);
              console.log(`[${localMap.name}] Attempt ${attempt + 1}: Success, blob created.`);
              success = true;
              break;
          } else {
               console.warn(`[${localMap.name}] Attempt ${attempt + 1}: Context changed during read (map.relativeThumbnailPath is now ${localMap?.relativeThumbnailPath}). Aborting blob creation.`);
               success = false;
               processedThumbnailPath = null;
               break;
          }
        } else {
          console.warn(`[${localMap.name}] File NOT found at relative path: ${relativePath}`);
          console.warn(`[${localMap.name}] Attempt ${attempt + 1}: File not found at relative path ${relativePath}`);
        }
      } catch (err: any) {
        console.error(`[${localMap.name}] Attempt ${attempt + 1}: Error loading image for ${relativePath}`, err);
        if (err?.message?.includes("os error 2") || err?.message?.includes("failed to read file")) {
            console.warn(`[${localMap.name}] File likely permanently missing. Stopping retries for ${relativePath}.`);
            break;
        }
      }

      if (!success && attempt < MAX_RETRIES - 1) {
        const delay = INITIAL_DELAY * Math.pow(BACKOFF_FACTOR, attempt);
        console.log(`[${localMap.name}] Attempt ${attempt + 1} failed. Retrying in ${delay.toFixed(0)}ms...`);
        await new Promise((res) => setTimeout(res, delay));
      }
    }

    isLoadingUrl = false;

    if (!success && cardElement && localMap?.relativeThumbnailPath === relativePath) {
         console.error(`[${localMap.name}] Failed to load image ${relativePath} after ${MAX_RETRIES} attempts.`);
    } else if (!success) {
         processedThumbnailPath = null;
    }
  }

  onMount(() => {
    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
          const currentlyVisible = entry.isIntersecting;
          if (currentlyVisible !== isVisible) {
               console.log(`[${localMap?.name}] Visibility changed to: ${currentlyVisible}`);
               isVisible = currentlyVisible;
          }
      });
    }, { threshold: 0.1 });

    if (cardElement) {
      observer.observe(cardElement);
    }

    return () => {
      observer?.disconnect();
      if (blobUrl && blobUrl.startsWith("blob:")) {
        console.log(`[${localMap?.name}] Revoking blob URL on component destroy/unmount`);
        URL.revokeObjectURL(blobUrl);
        blobUrl = "";
      }
    };
  });

  async function openInExplorer(e: MouseEvent) {
    if (!localMap?.path) {
        console.error("[LocalMapCard Error] Cannot open in explorer, localMap or localMap.path is missing. Prop value:", JSON.parse(JSON.stringify(localMap ?? {})));
        return;
    }
    try {
      console.log(`[LocalMapCard] Revealing item: ${localMap.path}`);
      await revealItemInDir(localMap.path);
    } catch (error) {
      console.error("Error using opener plugin:", error);
    }
  }

  function triggerDelete(e: MouseEvent) {
    e.stopPropagation();
    if (!localMap?.path) {
         console.error("[LocalMapCard Error] Cannot trigger delete, localMap or localMap.path is missing. Prop value:", JSON.parse(JSON.stringify(localMap ?? {})));
         return;
    }
    console.log(`[LocalMapCard] Dispatching requestDelete for path: ${localMap.path}`);
    dispatch("requestDelete", { path: localMap.path, name: localMap.name });
  }
</script>

<div bind:this={cardElement} class="relative flex-shrink-0 w-80 aspect-video">
  <GenericCard
    imageUrl={blobUrl}
    fallbackIcon={localMap?.isDirectory ? "📁" : "📄"}
    badgeText={localMap?.size != null ? formatFileSize(localMap.size) : ""}
    title={localMap?.name ?? 'Unnamed'} >
    <span slot="overlay">
      <button
        class="btn btn-secondary btn-sm pointer-events-auto"
        on:click|preventDefault|stopPropagation={openInExplorer}
        title="Open in File Explorer"
        disabled={!canPerformActions}
        >
        Open
      </button>
      <button
        class="btn btn-error btn-sm pointer-events-auto"
        on:click|preventDefault|stopPropagation={triggerDelete}
        title="Delete Local Map"
        disabled={!canPerformActions}
        >
        Delete
      </button>
    </span>
  </GenericCard>

  {#if isLoadingUrl && !blobUrl}
    <div class="absolute inset-0 grid place-content-center bg-base-300/50 z-30 rounded-lg">
      <span class="loading loading-spinner loading-sm"></span>
    </div>
  {/if}
</div>