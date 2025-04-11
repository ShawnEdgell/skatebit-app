<!-- src/lib/components/LocalMapCard.svelte -->
<script lang="ts">
  import type { LocalMapEntry } from "$lib/ts/fsOperations";
  import GenericCard from "./GenericCard.svelte";
  import { documentDir, join } from "@tauri-apps/api/path";
  import { readFile, exists, BaseDirectory } from "@tauri-apps/plugin-fs";
  import { revealItemInDir } from "@tauri-apps/plugin-opener";
  import { baseFolder } from "$lib/ts/fsOperations";
  import { normalizePath } from "$lib/ts/pathUtils";
  import { createEventDispatcher, onMount, tick } from "svelte"; // onDestroy removed, tick added

  export let localMap: LocalMapEntry;
  const dispatch = createEventDispatcher();

  const relativeMapsFolder = normalizePath(`${baseFolder}/Maps`);

  let blobUrl = "";
  let isLoadingUrl = false;
  let observer: IntersectionObserver;
  let cardElement: HTMLElement;
  let isVisible = false;
  // Track the path we last successfully loaded or failed permanently loading
  let processedPath: string | undefined | null = null;

  // --- Reactive Loading Trigger ---
  // This runs whenever isVisible or localMap.thumbnailPath changes.
  $: if (isVisible && localMap.thumbnailPath && localMap.thumbnailPath !== processedPath && !isLoadingUrl) {
      console.log(`[${localMap.name}] Reactive trigger: Path available (${localMap.thumbnailPath}), component visible.`);
      // Use tick to ensure Svelte updates are flushed before async load
      tick().then(() => {
          // Double-check conditions within the async context in case state changed rapidly
          if (isVisible && localMap.thumbnailPath && localMap.thumbnailPath !== processedPath && !isLoadingUrl) {
              loadImageData(localMap.thumbnailPath, localMap.thumbnailMimeType);
          }
      });
  }

  // --- Reset on Map Change ---
  // If the component is reused for a different map, reset state.
  $: if (localMap?.name && blobUrl && localMap.thumbnailPath !== processedPath) {
      console.log(`[${localMap.name}] Map data changed, resetting blobUrl and processedPath.`);
      URL.revokeObjectURL(blobUrl);
      blobUrl = "";
      processedPath = null; // Allow reloading if the new map becomes visible
      isLoadingUrl = false; // Reset loading state
      // The reactive block above will trigger loading if needed for the new map
  }

  async function loadImageData(relativePath: string | undefined, mimeType: string | undefined) {
    // Guard against invalid inputs or re-entry
    if (!relativePath || !mimeType) {
      console.warn(`[${localMap.name}] loadImageData called with invalid path/mime.`);
      return;
    }
    if (isLoadingUrl) {
        console.warn(`[${localMap.name}] loadImageData called while already loading.`);
        return;
    }

    console.log(`[${localMap.name}] loadImageData: Attempting load for path: ${relativePath}`);
    isLoadingUrl = true;
    processedPath = relativePath; // Mark this path as being processed

    // Clear previous blob if any exists (should be handled by reset logic, but safe)
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
        await tick(); // Allow UI updates
        await new Promise(res => setTimeout(res, 50)); // Brief pause for FS

        console.log(`[${localMap.name}] Attempt ${attempt + 1}: Checking existence: ${relativePath}`);
        const fileExists = await exists(relativePath, { baseDir: BaseDirectory.Document });

        if (fileExists) {
          console.log(`[${localMap.name}] Attempt ${attempt + 1}: File exists, reading...`);
          const binaryData = await readFile(relativePath, { baseDir: BaseDirectory.Document });

          // Context check BEFORE creating blob
          if (cardElement && localMap?.thumbnailPath === relativePath) {
              const blob = new Blob([binaryData], { type: mimeType });
              blobUrl = URL.createObjectURL(blob);
              console.log(`[${localMap.name}] Attempt ${attempt + 1}: Success, blob created.`);
              success = true;
              break;
          } else {
               console.warn(`[${localMap.name}] Attempt ${attempt + 1}: Context changed during read. Aborting.`);
               success = false; // Ensure failure if context changed
               processedPath = null; // Allow retry if context becomes valid again later? Maybe not needed.
               break;
          }
        } else {
          console.warn(`[${localMap.name}] Attempt ${attempt + 1}: File not found.`);
        }
      } catch (err) {
        console.error(`[${localMap.name}] Attempt ${attempt + 1}: Error loading image`, err);
      }

      if (!success && attempt < MAX_RETRIES - 1) {
        const delay = INITIAL_DELAY * Math.pow(BACKOFF_FACTOR, attempt);
        console.log(`[${localMap.name}] Attempt ${attempt + 1} failed. Retrying in ${delay.toFixed(0)}ms...`);
        await new Promise((res) => setTimeout(res, delay));
      }
    }

    isLoadingUrl = false; // Loading finished
    if (!success && cardElement && localMap?.thumbnailPath === relativePath) {
         console.error(`[${localMap.name}] Failed to load image ${relativePath} after ${MAX_RETRIES} attempts.`);
         // Keep processedPath set so we don't retry indefinitely via reactivity
    } else if (!success) {
         // Failed due to context change or other issue
         processedPath = null; // Reset so it might retry if props align later
    }
  }

  onMount(() => {
    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
          // Simply track visibility state
          const currentlyVisible = entry.isIntersecting;
          if (currentlyVisible !== isVisible) {
               console.log(`[${localMap?.name}] Visibility changed to: ${currentlyVisible}`);
               isVisible = currentlyVisible;
               // Reactive block $: will handle triggering load if needed
          }
      });
    }, { threshold: 0.1 }); // Adjust threshold if needed

    if (cardElement) {
      observer.observe(cardElement);
    }

    // Cleanup
    return () => {
      observer?.disconnect();
      if (blobUrl && blobUrl.startsWith("blob:")) {
        console.log(`[${localMap?.name}] Revoking blob URL on destroy`);
        URL.revokeObjectURL(blobUrl);
        blobUrl = "";
      }
    };
  });

  // Standard utility functions (no changes needed)
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
      const fullPath = normalizePath(await join(docDir, relativeMapsFolder, localMap.name));
      await revealItemInDir(fullPath);
    } catch (error) {
      console.error("Error using opener plugin:", error);
    }
  }

  function triggerDelete(e: MouseEvent) {
    e.stopPropagation();
    dispatch("requestDelete", { name: localMap.name });
  }
</script>

<!-- Template -->
<div bind:this={cardElement} class="relative flex-shrink-0 w-80 aspect-video">
  <GenericCard
    imageUrl={blobUrl}
    fallbackIcon={localMap.isDirectory ? "📁" : "📄"}
    badgeText={!localMap.isDirectory ? formatFileSize(localMap.size) : ""}
    title={localMap.name}>
    <span slot="overlay">
      <button
        class="btn btn-secondary btn-sm pointer-events-auto"
        on:click|preventDefault|stopPropagation={openInExplorer}
        title="Open in File Explorer">
        Open
      </button>
      <button
        class="btn btn-error btn-sm pointer-events-auto"
        on:click|preventDefault|stopPropagation={triggerDelete}
        title="Delete Local Map">
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