<!-- Page.svelte -->
<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { getCurrentWebview } from '@tauri-apps/api/webview';
  import { invoke } from '@tauri-apps/api/core';
  import { documentDir, join } from '@tauri-apps/api/path';
  import { TabSwitcher, FileList, PathHeader, FileActions } from '$lib';
  import {
    loadEntries,
    baseFolder,
    openDirectory,
    goUp,
    promptNewFolder,
    promptNewFile,
    renameEntry,
    deleteEntry
  } from '$lib';
  import { handleDroppedPaths } from '$lib';
  import type { DirEntry } from '@tauri-apps/plugin-fs';

  const tabs = [
    { label: "Maps", subfolder: "Maps" },
    { label: "Gear", subfolder: "Gear" },
    { label: "XLGM Assets", subfolder: "XLGearModifier/Asset Packs" },
    { label: "Stats", subfolder: "XXLMod3/StatsCollections" },
    { label: "Stance", subfolder: "XXLMod3/StanceCollections" },
    { label: "Steeze", subfolder: "XXLMod3/SteezeCollections" },
    { label: "BonedOllieMod", subfolder: "BonedOllieMod" },
    { label: "Walking Mod", subfolder: "walking-mod/animations" }
    // … add other tabs as needed
  ];

  let currentPath = baseFolder;
  let entries: DirEntry[] = [];
  let fileInput: HTMLInputElement;
  let isDraggingOverZone = false;
  let unlisten: (() => void) | null = null;
  let isLoadingEntries = false;

  // Since we want the entire viewport to be the drop zone, we update this function
  // to always return true.
  function isInsideDropZone(x: number, y: number): boolean {
    return true;
  }

  async function refreshEntries() {
    isLoadingEntries = true;
    try {
      entries = await loadEntries(currentPath);
    } catch (e) {
      console.error("Error loading entries:", e);
      entries = [];
    } finally {
      isLoadingEntries = false;
    }
  }

  async function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const files = target?.files;
  if (!files || files.length === 0) return;

  // Get the absolute document directory once
  let docDir: string | undefined;
  try {
    docDir = await documentDir();
  } catch (err) {
    console.error("Failed to get document directory:", err);
    // Handle error appropriately - maybe show a message to the user
    return;
  }

  for (const file of Array.from(files)) {
    try {
      const buffer = await file.arrayBuffer();

      // *** FIX: Construct the ABSOLUTE path for the save_file command ***
      // Assumes 'currentPath' is relative to the document directory base
      // If currentPath IS already absolute, this logic needs adjustment, but
      // based on the unzip fix, currentPath is likely relative to docDir context.
      const absoluteSavePath = await join(docDir, currentPath, file.name);
      console.log("Attempting to save file to absolute path:", absoluteSavePath); // Add logging

      await invoke("save_file", {
        path: absoluteSavePath, // Send the absolute path
        contents: Array.from(new Uint8Array(buffer))
      });
      console.log(`Successfully invoked save_file for: ${absoluteSavePath}`);

    } catch (err) {
      // Log the specific path that failed if possible
      const intendedPath = docDir ? await join(docDir, currentPath, file.name) : `[docDirError]/${currentPath}/${file.name}`;
      console.error(`Save Error for ${file.name} at intended path ${intendedPath}:`, err);
       // You might want a user-facing error message here too
    }
  }
  target.value = ""; // Clear the input
  await refreshEntries(); // Refresh the list
}

  async function handleSwitchTab(subfolder: string) {
    try {
      currentPath = await openDirectory(baseFolder, subfolder);
      await refreshEntries();
    } catch (e) {
      console.error("Tab switch error", e);
    }
  }

  async function handleOpenDirectory(name: string) {
    try {
      currentPath = await openDirectory(currentPath, name);
      await refreshEntries();
    } catch(e) {
      console.error(e);
    }
  }

  async function handleGoUp() {
    if (currentPath === baseFolder) return;
    try {
      currentPath = await goUp(currentPath);
      await refreshEntries();
    } catch(e) {
      console.error("Error during goUp:", e);
    }
  }

  async function handleNewFolder() { 
    await promptNewFolder(currentPath);
    await refreshEntries();
  }
  async function handleNewFile() { 
    await promptNewFile(currentPath);
    await refreshEntries();
  }
  async function handleRename(name: string) { 
    await renameEntry(currentPath, name); 
    await refreshEntries();
  }
  async function handleDelete(name: string) { 
    await deleteEntry(currentPath, name); 
    await refreshEntries();
  }
  async function handleUpload() { fileInput?.click(); }

  onMount(async () => {
    // Wait for the DOM to update.
    await tick();
    await refreshEntries();

    // Listen to drag drop events globally.
    unlisten = await getCurrentWebview().onDragDropEvent(async (event) => {
      let isInside = false;
      if (event.payload.type === 'over' || event.payload.type === 'drop') {
        if ('position' in event.payload) {
          isInside = isInsideDropZone(event.payload.position.x, event.payload.position.y);
        }
      }
      switch (event.payload.type) {
        case 'over':
          isDraggingOverZone = isInside;
          break;
        case 'drop':
          if (isInside && 'paths' in event.payload && event.payload.paths?.length > 0) {
            try {
              await handleDroppedPaths(event.payload.paths, currentPath);
              await refreshEntries();
            } catch (error) {
              console.error("Drop Handle Error:", error);
            }
          }
          isDraggingOverZone = false;
          break;
        case 'leave':
          isDraggingOverZone = false;
          break;
      }
    });
  });

  onDestroy(() => {
    unlisten?.();
  });
</script>

<div class="space-y-4 w-full">
  <TabSwitcher {tabs} {currentPath} baseFolder={baseFolder} onSwitchTab={handleSwitchTab} />
  <PathHeader {currentPath} {baseFolder} onGoBack={handleGoUp} />
  
  <!-- File list container without the dropzone binding -->
  <div class="relative w-full bg-base-200" role="region" aria-label="File list">
    <FileList {entries} loading={isLoadingEntries} onOpenDirectory={handleOpenDirectory} onRename={handleRename} onDelete={handleDelete} />
  </div>

  <input type="file" multiple bind:this={fileInput} on:change={handleFileChange} class="hidden" />
  <FileActions onNewFolder={handleNewFolder} onNewFile={handleNewFile} onUpload={handleUpload} />
</div>

<!-- Full-screen drop zone overlay -->
{#if isDraggingOverZone}
  <div class="fixed inset-0 z-50 flex items-center justify-center pointer-events-none mt-16 bg-neutral/60 bg-opacity-75 backdrop-blur-sm">
    <div class="rounded-box p-8">
      <p class="text-xl font-bold">Drop files or folders here</p>
    </div>
  </div>
{/if}