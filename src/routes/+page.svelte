<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { documentDir, join } from '@tauri-apps/api/path';
  import { onMount } from 'svelte';
  import {
    readDir,
    BaseDirectory,
    create,
    mkdir,
    rename,
    remove
  } from '@tauri-apps/plugin-fs';
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
  // Start at the base folder.
  let currentPath = baseFolder;
  let fileInput: HTMLInputElement;

  async function loadEntries() {
    try {
      // Read from the current path under Documents.
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

  // Switch the active tab to a subfolder within SkaterXL.
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

    // Clear file input so uploading the same file again triggers the event.
    target.value = "";
    await loadEntries();
  }

  async function openDirectory(dirName: string) {
    currentPath += `/${dirName}`;
    await loadEntries();
  }

  async function goUp() {
    // Prevent going above the base folder.
    if (currentPath === baseFolder) return;
    currentPath = currentPath.split('/').slice(0, -1).join('/');
    await loadEntries();
  }

  // Prompt for new folder name and create it.
  async function promptNewFolder() {
    const folderName = prompt("Enter new folder name:");
    if (folderName) {
      await mkdir(`${currentPath}/${folderName}`, { baseDir: BaseDirectory.Document });
      await loadEntries();
    }
  }

  // Prompt for new file name and create it.
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

  onMount(() => {
    loadEntries();
  });
</script>

<!-- UI Markup -->
<div class="min-h-screen flex flex-col items-center bg-base-100 p-4">
  <!-- Tab Switcher -->
  <div class="tabs mb-6">
    {#each tabs as tab}
      <button 
        class="tab tab-bordered tab-sm {currentPath === `${baseFolder}/${tab.subfolder}` ? 'tab-active' : ''}" 
        on:click={() => switchTab(tab.subfolder)}>
        {tab.label}
      </button>
    {/each}
  </div>

  <!-- Current Path Display -->
  <div class="mb-3">
    <span class="text-lg font-semibold">📂 {currentPath}</span>
  </div>

  <!-- Navigation Button -->
  <div class="mb-8">
    <button class="btn btn-xs" on:click={goUp} disabled={currentPath === baseFolder}>
      ⬆️ Go Up
    </button>
  </div>

  <!-- New Folder / File Controls (using prompts) -->
  <div class="flex flex-wrap gap-2 mb-3">
    <button class="btn btn-xs btn-success" on:click={promptNewFolder}>📁 New Folder</button>
    <button class="btn btn-xs btn-info" on:click={promptNewFile}>📄 New File</button>
    <!-- File Upload -->
    <div>
      <button class="btn btn-xs btn-soft" on:click={() => fileInput.click()}>📤 Upload File</button>
      <input type="file" multiple bind:this={fileInput} on:change={handleFileChange} hidden />
    </div>
  </div>

  <!-- File/Folder List -->
  {#if entries.length > 0}
    <div class="w-full max-w-lg rounded-box overflow-y-auto max-h-80 h-full bg-base-200">
      <ul class="menu w-full">
        {#each entries as entry}
          <li>
            <div class="flex items-center w-full">
              <!-- File/Folder name container with proper truncation -->
              <div class="flex-1 overflow-hidden w-full">
                {#if entry.isDirectory}
                  <button 
                    class="w-full text-left p-1 truncate" 
                    on:click={() => openDirectory(entry.name)}>
                    📁 {entry.name}
                  </button>
                {:else}
                  <span class="w-full p-1 block truncate">
                    📄 {entry.name}
                  </span>
                {/if}
              </div>
              <!-- Action Buttons container -->
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
    <p class="text-warning mt-4">No files found or an error occurred.</p>
  {/if}
</div>
