// src/lib/stores/explorerStore.ts
import { writable, get } from "svelte/store";
import { loadDirectoryEntries } from "$lib/services/fileService";
import { explorerDirectory } from "./globalPathsStore";
import { ListingStatus } from "$lib/types/fsTypes";
import type { FsEntry } from "$lib/types/fsTypes";

export const entries = writable<FsEntry[]>([]);
export const currentPath = writable("");
export const isLoading = writable(false);
export const folderMissing = writable(false);

export async function refreshExplorer(path?: string) {
  const baseDir = get(explorerDirectory);
  const current = get(currentPath);
  const dir = path || current || baseDir;

  if (!dir || dir.trim() === "") {
    console.error("refreshExplorer: Received invalid or empty path:", dir);
    entries.set([]);
    isLoading.set(false);
    return;
  }

  isLoading.set(true);
  try {
    const result = await loadDirectoryEntries(dir);
    if (result.status === ListingStatus.DoesNotExist) {
      folderMissing.set(true);
      currentPath.set(dir);
      entries.set([]);
    } else {
      folderMissing.set(false);
      entries.set(result.entries);
      currentPath.set(result.path);
    }
  } catch (e) {
    console.error("Error loading directory entries for", dir, e);
    entries.set([]);
  } finally {
    isLoading.set(false);
  }
}

// Automatically refresh explorer whenever explorerDirectory changes.
explorerDirectory.subscribe((path) => {
  if (path && path.trim() !== "") {
    // Always use explorerDirectory, ignoring any changes to mapsDirectory.
    refreshExplorer(path);
  } else {
    console.warn(
      "explorerDirectory has an invalid value. Skipping explorer refresh."
    );
  }
});

export async function initializeStore(): Promise<void> {
  await refreshExplorer();
}

export async function setPath(newPath: string): Promise<void> {
  await refreshExplorer(newPath);
}
