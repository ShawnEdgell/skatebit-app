<!-- Page.svelte -->
<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { getCurrentWebview } from '@tauri-apps/api/webview';
  import { invoke } from '@tauri-apps/api/core';
  import { join } from '@tauri-apps/api/path';
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

  let currentPath = baseFolder;
  let entries: DirEntry[] = [];
  let fileInput: HTMLInputElement;
  let isDraggingOverZone = false;
  let dropZone: HTMLElement;
  let unlisten: (() => void) | null = null;
  let isLoadingEntries = false;

  const tabs = [
    { label: "Maps", subfolder: "Maps" },
    { label: "Gear", subfolder: "Gear" },
    { label: "XLGM Assets", subfolder: "XLGearModifier/Asset Packs" },
    { label: "Stats", subfolder: "XXLMod3/StatsCollections" },
    { label: "Stance", subfolder: "XXLMod3/StanceCollections" },
    { label: "Steeze", subfolder: "XXLMod3/SteezeCollections" },
    { label: "BonedOllieMod", subfolder: "BonedOllieMod" },
    // … other tabs
  ];

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
    for (const file of Array.from(files)) {
      try {
        const buffer = await file.arrayBuffer();
        const path = await join(currentPath, file.name);
        await invoke("save_file", { path, contents: Array.from(new Uint8Array(buffer)) });
      } catch (err) { console.error(`Save Error: ${file.name}`, err); }
    }
    target.value = "";
    await refreshEntries();
  }

  async function handleSwitchTab(subfolder: string) {
    try {
      currentPath = await openDirectory(baseFolder, subfolder);
      await refreshEntries();
    } catch(e) {
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

  async function handleNewFolder() { await promptNewFolder(currentPath); await refreshEntries(); }
  async function handleNewFile() { await promptNewFile(currentPath); await refreshEntries(); }
  async function handleRename(name: string) { await renameEntry(currentPath, name); await refreshEntries(); }
  async function handleDelete(name: string) { await deleteEntry(currentPath, name); await refreshEntries(); }
  async function handleUpload() { fileInput?.click(); }

  function allowDrop(event: DragEvent) { event.preventDefault(); }
  function isInsideDropZone(x: number, y: number): boolean {
    if (!dropZone) return false;
    const rect = dropZone.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  onMount(async () => {
    await tick();
    if (!dropZone) {
      console.error("Drop zone element not bound");
      return;
    }
    await refreshEntries();

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

  onDestroy(() => { unlisten?.(); });
</script>

<div class="space-y-4 w-full">
  <TabSwitcher {tabs} {currentPath} baseFolder={baseFolder} onSwitchTab={handleSwitchTab} />
  <PathHeader {currentPath} {baseFolder} onGoBack={handleGoUp} />
  <div
    class="relative w-full bg-base-200"
    bind:this={dropZone}
    on:dragover={allowDrop}
    on:drop={allowDrop}
    class:border-primary={isDraggingOverZone}
    class:border-base-300={!isDraggingOverZone}
    role="region"
    aria-label="File list and drop zone">
    {#if isDraggingOverZone}
      <div class="absolute inset-0 bg-neutral/60 bg-opacity-50 flex items-center justify-center pointer-events-none z-10 rounded-box backdrop-blur-sm">
        <p class="text-xl font-bold">Drop files or folders here</p>
      </div>
    {/if}
    <FileList {entries} onOpenDirectory={handleOpenDirectory} onRename={handleRename} onDelete={handleDelete} />
  </div>
  <input type="file" multiple bind:this={fileInput} on:change={handleFileChange} class="hidden" />
  <FileActions onNewFolder={handleNewFolder} onNewFile={handleNewFile} onUpload={handleUpload} />
</div>
