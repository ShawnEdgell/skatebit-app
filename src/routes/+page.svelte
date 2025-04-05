<script lang="ts">
  import { join } from '@tauri-apps/api/path';
  import { onMount } from 'svelte';
  import {
    readDir, BaseDirectory, create, mkdir, rename, remove
  } from '@tauri-apps/plugin-fs';
  import type { DirEntry } from '@tauri-apps/plugin-fs';

  let entries: DirEntry[] = [];
  let currentPath = "SkaterXL";
  let newName = "";

  async function loadEntries() {
    try {
      entries = await readDir(currentPath, { baseDir: BaseDirectory.Document });
      entries.sort((a, b) => a.isDirectory === b.isDirectory
        ? a.name.localeCompare(b.name)
        : (a.isDirectory ? -1 : 1));
    } catch (error) {
      console.error("Failed to read directory:", error);
      entries = [];
    }
  }

  async function openDirectory(dirName: string) {
    currentPath += `/${dirName}`;
    await loadEntries();
  }

  async function goUp() {
    if (currentPath === "SkaterXL") return;
    currentPath = currentPath.split('/').slice(0, -1).join('/');
    await loadEntries();
  }

  async function createFolder() {
    if (!newName) return;
    await mkdir(`${currentPath}/${newName}`, { baseDir: BaseDirectory.Document });
    newName = "";
    await loadEntries();
  }

  async function createFile() {
    if (!newName) return;

    try {
      const file = await create(`${currentPath}/${newName}`, {
        baseDir: BaseDirectory.Document
      });
      newName = "";
      await loadEntries();
    } catch (err) {
    console.error("Failed to create file:", err);
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
      await remove(`${currentPath}/${name}`, { baseDir: BaseDirectory.Document, recursive: true });
      await loadEntries();
    }
  }

  onMount(loadEntries);
</script>

<div class="min-h-screen flex flex-col items-center bg-base-100 p-4 gap-1">
  <h1 class="text-3xl font-bold mb-2">📂 SkaterXL Directory</h1>
  <p class="mb-2 font-mono text-sm text-gray-500">{currentPath}</p>

  <button class="btn btn-sm mb-2" on:click={goUp} disabled={currentPath === "SkaterXL"}>
    ⬆️ Go Up
  </button>

  <div class="flex gap-2 mb-2">
    <input class="input input-bordered input-sm" bind:value={newName} placeholder="Name..." />
    <button class="btn btn-sm btn-success" on:click={createFolder}>📁 New Folder</button>
    <button class="btn btn-sm btn-info" on:click={createFile}>📄 New File</button>
  </div>

  {#if entries.length > 0}
    <div class="w-full max-w-md rounded-box overflow-y-auto max-h-80 h-full bg-base-200 ">
      <ul class="menu w-full ">
        {#each entries as entry}
          <li>
            <div class="flex justify-between items-center gap-2 ">
              {#if entry.isDirectory}
                <button class="flex-1 text-left rounded p-1"
                        on:click={() => openDirectory(entry.name)}>
                  📁 {entry.name}
                </button>
              {:else}
                <div class="flex-1 flex items-center gap-2 py-1 px-2 truncate">
                  📄 {entry.name}
                </div>
              {/if}

              <div class="flex gap-1">
                <button class="btn btn-xs btn-warning" on:click={() => renameEntry(entry.name)}>✏️</button>
                <button class="btn btn-xs btn-error" on:click={() => deleteEntry(entry.name)}>🗑️</button>
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
