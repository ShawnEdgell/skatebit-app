import { writable, get } from "svelte/store";
import type { FsEntry, DirectoryListingResult } from "$lib/ts/fsOperations";
import { loadLocalMaps } from "$lib/ts/fsOperations";
import { normalizePath } from "$lib/ts/pathUtils";
import { listen } from "@tauri-apps/api/event";
import { handleError } from "$lib/ts/errorHandler";
import { mapsFolder } from "$lib/stores/mapsFolderStore";

export const localMapsStore = writable<FsEntry[]>([]);
export const localMapsInitialized = writable<boolean>(false);
export const isLoadingLocalMaps = writable<boolean>(false);

export async function refreshLocalMaps() {
  if (get(isLoadingLocalMaps)) return;
  isLoadingLocalMaps.set(true);

  try {
    // Use the current maps folder from configuration (absolute path)
    const currentMapsFolder = mapsFolder.get();
    if (!currentMapsFolder || currentMapsFolder.startsWith("/error")) {
      throw new Error("Maps folder path is not set or invalid.");
    }
    const normalizedMapsFolder = normalizePath(currentMapsFolder);
    if (!normalizedMapsFolder) {
      throw new Error("Could not determine normalized maps folder path.");
    }

    console.log(`Refreshing local maps using folder: ${normalizedMapsFolder}`);

    // Load local maps from the configured folder.
    const result: DirectoryListingResult = await loadLocalMaps(
      normalizedMapsFolder
    );

    localMapsStore.set(result.entries);
    localMapsInitialized.set(true);
    console.log(
      `[Store] Local maps refreshed. Status: ${result.status}, Count: ${result.entries.length}`
    );
  } catch (err) {
    console.error("Error refreshing local maps store:", err);
    handleError(err, "Refreshing local maps");
    localMapsStore.set([]);
    localMapsInitialized.set(true);
  } finally {
    isLoadingLocalMaps.set(false);
  }
}

export async function initializeLocalMapsWatcher() {
  console.log("Initializing local maps watcher...");
  try {
    const unlistenFn = await listen("maps-changed", (event) => {
      console.log("Received maps-changed event:", event.payload);
      refreshLocalMaps();
    });
    console.log("Local maps watcher initialized.");
    if (!get(localMapsInitialized)) {
      await refreshLocalMaps();
    }
    return unlistenFn;
  } catch (error) {
    handleError(error, "Initializing maps watcher listener");
    localMapsInitialized.set(true);
    isLoadingLocalMaps.set(false);
    return () => {};
  }
}
