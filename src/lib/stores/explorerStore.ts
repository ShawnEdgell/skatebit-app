import { writable, get } from "svelte/store";
import type { DirEntry } from "@tauri-apps/plugin-fs";
// Updated imports—note that we now import createFolder, createFile, renameEntry, and deleteEntry.
import {
  loadEntries,
  baseFolder,
  openDirectory,
  goUp,
  createFolder, // was promptNewFolder
  createFile, // was promptNewFile
  renameEntry,
  deleteEntry,
} from "$lib/ts/fsOperations";

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
    // Now use createFolder instead of promptNewFolder.
    newFolder: async (folderName: string) => {
      await createFolder(get(currentPath), folderName);
      await refresh();
    },
    // Now use createFile instead of promptNewFile.
    newFile: async (fileName: string) => {
      await createFile(get(currentPath), fileName);
      await refresh();
    },
    // Rename now accepts newName as a parameter.
    rename: async (oldName: string, newName: string) => {
      await renameEntry(get(currentPath), oldName, newName);
      await refresh();
    },
    delete: async (name: string) => {
      await deleteEntry(get(currentPath), name);
      await refresh();
    },
  };
}

export const explorerStore = createExplorerStore();
