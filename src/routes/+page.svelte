<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { documentDir, join, basename } from '@tauri-apps/api/path';
  import { onMount } from 'svelte';
  import { getCurrentWebview } from '@tauri-apps/api/webview';
  import {
    readDir,
    BaseDirectory,
    create,
    mkdir,
    rename,
    remove,
    stat
  } from '@tauri-apps/plugin-fs';
  import { readFile, writeFile } from '@tauri-apps/plugin-fs';
  import type { DirEntry } from '@tauri-apps/plugin-fs';

  // The base folder is Documents/SkaterXL.
  const baseFolder = "SkaterXL";

  // Define the subfolder tabs relative to the base folder.
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

  async function loadEntries() {
    try {
      entries = await readDir(currentPath, { baseDir: BaseDirectory.Document });
      entries.sort((a, b) =>
        a.isDirectory === b.isDirectory
          ? a.name.localeCompare(b.name)
          : (a.isDirectory ? -1 : 1)
      );
    } catch (error) {
      console.error("Failed to read directory:", error);
      entries = [];
    }
  }

  async function switchTab(subfolder: string) {
    currentPath = `${baseFolder}/${subfolder}`;
    await loadEntries();
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
        console.log(`✅ Saved file: ${file.name}`);
      } catch (err) {
        console.error("❌ Error saving file:", err);
      }
    }
    target.value = "";
    await loadEntries();
  }

  async function openDirectory(dirName: string) {
    currentPath += `/${dirName}`;
    await loadEntries();
  }

  async function goUp() {
    if (currentPath === baseFolder) return;
    currentPath = currentPath.split('/').slice(0, -1).join('/');
    await loadEntries();
  }

  async function promptNewFolder() {
    const folderName = prompt("Enter new folder name:");
    if (folderName) {
      await mkdir(`${currentPath}/${folderName}`, { baseDir: BaseDirectory.Document });
      await loadEntries();
    }
  }

  async function promptNewFile() {
    const fileName = prompt("Enter new file name:");
    if (fileName) {
      try {
        await create(`${currentPath}/${fileName}`, { baseDir: BaseDirectory.Document });
        await loadEntries();
      } catch (err) {
        console.error("Failed to create file:", err);
      }
    }
  }

  async function renameEntry(oldName: string) {
    const newEntryName = prompt("New name:", oldName);
    if (!newEntryName) return;
    const oldPath = await join(currentPath, oldName);
    const newPath = await join(currentPath, newEntryName);
    await rename(oldPath, newPath);
    await loadEntries();
  }

  async function deleteEntry(name: string) {
    if (confirm(`Delete "${name}"? This action can't be undone.`)) {
      await remove(`${currentPath}/${name}`, {
        baseDir: BaseDirectory.Document,
        recursive: true
      });
      await loadEntries();
    }
  }

  // --- DRAG & DROP HANDLING ---
  async function copyFile(source: string, destDir: string) {
    try {
      console.log("Dropped file detected:", source);
      const fileData = await readFile(source);
      const fileName = source.split(/[\\/]/).pop();
      if (!fileName) return;
      const docDir = await documentDir();
      const targetPath = await join(docDir, destDir, fileName);
      await writeFile(targetPath, fileData, { baseDir: BaseDirectory.Document });
      console.log(`Copied file from ${source} to ${targetPath}`);
    } catch (error) {
      console.error("Error processing dropped path", source, error);
    }
  }

  async function copyFolder(source: string, destDir: string) {
    console.log("Dropped folder detected:", source);
    const folderName = source.split(/[\\/]/).pop();
    if (!folderName) return;
    const docDir = await documentDir();
    const targetFolder = await join(docDir, destDir, folderName);
    await mkdir(targetFolder, { baseDir: BaseDirectory.Document }).catch(() => {});
    const items = await readDir(source);
    const newDestDir = await join(destDir, folderName);
    for (const item of items) {
      const itemSourcePath = `${source}/${item.name}`;
      if (item.isDirectory) {
        await copyFolder(itemSourcePath, newDestDir);
      } else {
        await copyFile(itemSourcePath, newDestDir);
      }
    }
    console.log(`Copied folder ${source} to ${targetFolder}`);
  }

  async function handleDroppedPaths(paths: string[]) {
    for (const p of paths) {
      try {
        console.log("Dropped path detected:", p);
        const info = await stat(p);
        if (info.isDirectory) {
          await copyFolder(p, currentPath);
        } else {
          await copyFile(p, currentPath);
        }
      } catch (error) {
        console.error("Error processing dropped path", p, error);
      }
    }
    isDragging = false;
    await loadEntries();
  }

  onMount(async () => {
    await loadEntries();
    const unlisten = await getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type === 'over') {
        isDragging = true;
        console.log('User dragging over at', event.payload.position);
      } else if (event.payload.type === 'drop') {
        console.log('User dropped files/folders:', event.payload.paths);
        handleDroppedPaths(event.payload.paths);
      } else {
        isDragging = false;
        console.log('File drop cancelled');
      }
    });
    // Optionally, store and call unlisten() when component unmounts.
  });
</script>

<style>
  /* Style for the drop zone overlay */
  .drop-zone-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.4);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }
  .drop-zone-overlay p {
    color: white;
    font-size: 1.5rem;
    font-weight: bold;
  }
</style>

<!-- UI Markup -->
<div class="min-h-screen flex flex-col items-center bg-base-100">
  <!-- Drop Zone Overlay -->
  {#if isDragging}
    <div class="drop-zone-overlay">
      <p>Drop files or folders here</p>
    </div>
  {/if}

  <!-- Tab Switcher -->
  <div class="tabs tabs-box tabs-sm flex justify-center w-full rounded-none">
    {#each tabs as tab}
      <button 
        class="tab tab-bordered tab-sm {currentPath === `${baseFolder}/${tab.subfolder}` ? 'tab-active' : ''}" 
        on:click={() => switchTab(tab.subfolder)}>
        {tab.label}
      </button>
    {/each}
  </div>

  <div class="w-full p-4 space-y-4">

  <!-- Current Path Display -->
  <div class="flex items-center w-full">
  <!-- Navigation Button -->
  <button class="btn btn-soft btn-xs mr-2" on:click={goUp} disabled={currentPath === baseFolder}>
    Go Back
  </button>
    <span class="font-semibold">📂 {currentPath}</span>
  </div>



  <!-- File/Folder List -->
  {#if entries.length > 0}
    <div class="w-full overflow-y-auto h-96 bg-base-200">
      <ul class="menu w-full">
        {#each entries as entry}
          <li>
            <div class="flex items-center w-full">
              <div class="flex-1 overflow-hidden w-full">
                {#if entry.isDirectory}
                  <button class="w-full text-left p-1 truncate" on:click={() => openDirectory(entry.name)}>
                    📁 {entry.name}
                  </button>
                {:else}
                  <span class="w-full text-left p-1 block truncate max-w-72">
                    📄 {entry.name}
                  </span>
                {/if}
              </div>
              <div class="flex gap-1 flex-shrink-0 ml-2">
                <button class="btn btn-xs btn-warning" on:click={() => renameEntry(entry.name)}>
                  ✏️
                </button>
                <button class="btn btn-xs btn-error" on:click={() => deleteEntry(entry.name)}>
                  🗑️
                </button>
              </div>
            </div>
          </li>
        {/each}
      </ul>
    </div>
  {:else}
    <p class="text-warning h-96">No files found or an error occurred.</p>
  {/if}
    <!-- New Folder / File Controls -->
  <div class="flex flex-wrap gap-2">
    <button class="btn btn-xs btn-success" on:click={promptNewFolder}>📁 New Folder</button>
    <button class="btn btn-xs btn-info" on:click={promptNewFile}>📄 New File</button>
    <div>
      <button class="btn btn-xs btn-soft" on:click={() => fileInput.click()}>📤 Upload File</button>
      <input type="file" multiple bind:this={fileInput} on:change={handleFileChange} hidden />
    </div>
  </div>
</div>
</div>