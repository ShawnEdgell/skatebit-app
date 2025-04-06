<script lang="ts">
  import { onMount } from 'svelte';
  import { getCurrentWebview } from '@tauri-apps/api/webview';
  import { invoke } from '@tauri-apps/api/core';
  import { documentDir, join } from '@tauri-apps/api/path';
  import { TabSwitcher, FileList, PathHeader, FileActions, loadEntries, baseFolder, openDirectory, goUp, promptNewFolder, promptNewFile, renameEntry, deleteEntry, copyFile, copyFolder, handleDroppedPaths } from '$lib';
  import type { DirEntry } from '@tauri-apps/plugin-fs';

  const tabs = [
    { label: "Maps", subfolder: "Maps" },
    { label: "Gear", subfolder: "Gear" },
    { label: "XLGM Assets", subfolder: "XLGearModifier/Asset Packs" },
    { label: "BonedOllieMod", subfolder: "BonedOllieMod" },
    { label: "Stats", subfolder: "XXLMod3/StatsCollections" },
    { label: "Steeze", subfolder: "XXLMod3/SteezeCollections" },
    { label: "Stance", subfolder: "XXLMod3/StanceCollections" }
  ];

  let entries: DirEntry[] = [];
  let currentPath = baseFolder;
  let fileInput: HTMLInputElement;
  let isDragging = false;
  let dropZone: HTMLElement;

  async function refreshEntries() {
    entries = await loadEntries(currentPath);
  }

  async function handleFileChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const files = target?.files;
    if (!files) return;
    const base = await documentDir();
    for (const file of Array.from(files)) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const fullPath = await join(base, currentPath, file.name);
        await invoke("save_file", {
          path: fullPath,
          contents: Array.from(uint8Array)
        });
        console.log(`Saved file: ${file.name}`);
      } catch (err) {
        console.error("Error saving file:", err);
      }
    }
    target.value = "";
    await refreshEntries();
  }

  async function handleSwitchTab(subfolder: string) {
    currentPath = `${baseFolder}/${subfolder}`;
    await refreshEntries();
  }

  async function handleOpenDirectory(name: string) {
    currentPath = await openDirectory(currentPath, name);
    await refreshEntries();
  }

  async function handleGoUp() {
    currentPath = await goUp(currentPath);
    await refreshEntries();
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

  async function handleUpload() {
    fileInput.click();
  }

  onMount(async () => {
    await refreshEntries();
    const unlisten = await getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type === 'over') {
        const rect = dropZone.getBoundingClientRect();
        const { x, y } = event.payload.position;
        isDragging = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
      } else if (event.payload.type === 'drop') {
        const rect = dropZone.getBoundingClientRect();
        const { x, y } = event.payload.position;
        const isInside = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
        if (isInside) {
          handleDroppedPaths(event.payload.paths, currentPath);
        }
        isDragging = false;
      } else {
        isDragging = false;
      }
    });
  });
</script>
<div class="space-y-4 not-prose">
<TabSwitcher {tabs} {currentPath} baseFolder={baseFolder} onSwitchTab={handleSwitchTab} />
<PathHeader {currentPath} {baseFolder} onGoBack={handleGoUp} />
<!-- Drop zone container -->
<div class="relative w-full rounded-box overflow-y-auto h-96 bg-base-200" bind:this={dropZone}>
  {#if isDragging}
    <div class="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center pointer-events-none">
      <p class="text-xl font-bold">Drop files or folders here</p>
    </div>
  {/if}
  <FileList {entries} onOpenDirectory={handleOpenDirectory} onRename={handleRename} onDelete={handleDelete} />
</div>
<input type="file" multiple bind:this={fileInput} on:change={handleFileChange} class="hidden" />
<FileActions onNewFolder={handleNewFolder} onNewFile={handleNewFile} onUpload={handleUpload} />
</div>