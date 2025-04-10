// src/lib/stores/explorerStore.ts
import { writable, get } from "svelte/store";
import type { DirEntry } from "@tauri-apps/plugin-fs";
import {
  loadEntries,
  baseFolder,
  openDirectory,
  goUp,
  promptNewFolder,
  promptNewFile,
  renameEntry,
  deleteEntry,
} from "$lib";

function createExplorerStore() {
  const entries = writable<DirEntry[]>([]);
  const currentPath = writable(baseFolder);
  const isLoading = writable(false);

  async function refresh() {
    isLoading.set(true);
    try {
      const data = await loadEntries(get(currentPath));
      entries.set(data);
    } catch (err) {
      console.error("Error loading entries:", err);
      entries.set([]);
    } finally {
      isLoading.set(false);
    }
  }

  return {
    entries,
    currentPath,
    isLoading,
    refresh,
    setPath: currentPath.set,
    openDirectory: async (name: string) => {
      const newPath = await openDirectory(get(currentPath), name);
      currentPath.set(newPath);
      await refresh();
    },
    goUp: async () => {
      if (get(currentPath) === baseFolder) return;
      const newPath = await goUp(get(currentPath));
      currentPath.set(newPath);
      await refresh();
    },
    newFolder: async () => {
      await promptNewFolder(get(currentPath));
      await refresh();
    },
    newFile: async () => {
      await promptNewFile(get(currentPath));
      await refresh();
    },
    rename: async (name: string) => {
      await renameEntry(get(currentPath), name);
      await refresh();
    },
    delete: async (name: string) => {
      await deleteEntry(get(currentPath), name);
      await refresh();
    },
  };
}

export const explorerStore = createExplorerStore();
