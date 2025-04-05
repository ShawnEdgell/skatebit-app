<script lang="ts">
  import { onMount } from 'svelte';
  import { readDir, BaseDirectory } from '@tauri-apps/plugin-fs';
  import type { DirEntry } from '@tauri-apps/plugin-fs';

  let entries: DirEntry[] = [];
  let currentPath = "SkaterXL";

  async function loadEntries() {
    try {
      entries = await readDir(currentPath, { baseDir: BaseDirectory.Document });
      entries.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
    } catch (error) {
      console.error("Failed to read directory:", error);
      entries = [];
    }
  }

  function openDirectory(dirName: string) {
    currentPath += `/${dirName}`;
    loadEntries();
  }

  function goUp() {
    if (currentPath === "SkaterXL") return;
    currentPath = currentPath.split('/').slice(0, -1).join('/');
    loadEntries();
  }

  onMount(loadEntries);
</script>

<div class="min-h-screen flex flex-col items-center justify-start bg-base-100 p-4">
  <h1 class="text-3xl font-bold mb-2">📂 SkaterXL Directory</h1>
  <p class="mb-4 font-mono text-sm text-gray-500">{currentPath}</p>

  <button 
    class="btn btn-sm mb-4" 
    on:click={goUp} 
    disabled={currentPath === "SkaterXL"}
  >
    ⬆️ Go Up
  </button>

  {#if entries.length > 0}
    <div class="w-full max-w-md bg-base-200 shadow-inner rounded-box overflow-y-auto max-h-96">
      <ul class="menu w-full">
        {#each entries as entry}
          <li>
            {#if entry.isDirectory}
              <button 
                class="flex items-center gap-2 text-left hover:bg-base-300 py-2 px-4 rounded"
                on:click={() => openDirectory(entry.name)}
              >
                📁 <span class="truncate">{entry.name}</span>
              </button>
            {:else}
              <div class="flex items-center gap-2 py-2 px-4">
                📄 <span class="truncate">{entry.name}</span>
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    </div>
  {:else}
    <p class="text-warning mt-4">No files found or an error occurred.</p>
  {/if}
</div>
