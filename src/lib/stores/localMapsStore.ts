import { writable, get } from "svelte/store";
import type { FsEntry, DirectoryListingResult } from "$lib/ts/fsOperations";
import { loadLocalMaps, baseFolder } from "$lib/ts/fsOperations";
import { normalizePath } from "$lib/ts/pathUtils";
import { listen } from "@tauri-apps/api/event";
import { handleError } from "$lib/ts/errorHandler";

export const localMapsStore = writable<FsEntry[]>([]);
export const localMapsInitialized = writable<boolean>(false);
export const isLoadingLocalMaps = writable<boolean>(false);

export async function refreshLocalMaps() {
  if (get(isLoadingLocalMaps)) return;
  isLoadingLocalMaps.set(true);

  try {
    // Calculate relative path
    const mapsRootRelativePath = normalizePath(`${baseFolder}/Maps`);

    // --- ADD CHECK FOR NULL PATH ---
    if (!mapsRootRelativePath) {
      throw new Error("Could not determine relative path for local maps.");
    }
    // --- END CHECK ---

    console.log(
      `Refreshing local maps using RELATIVE path: ${mapsRootRelativePath}`
    );

    // Call with the guaranteed non-null string
    const result: DirectoryListingResult = await loadLocalMaps(
      mapsRootRelativePath
    );

    localMapsStore.set(result.entries);
    localMapsInitialized.set(true);
    console.log(
      `[Store] Local maps store refreshed. Status: ${result.status}, Count: ${result.entries.length}`
    );
  } catch (err) {
    console.error("Error refreshing local maps store:", err);
    handleError(err, "Refreshing local maps"); // Pass error to handler
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
      refreshLocalMaps(); // No argument needed
    });
    console.log("Local maps watcher initialized.");
    if (!get(localMapsInitialized)) {
      await refreshLocalMaps(); // Initial load
    }
    return unlistenFn; // Return the actual unlisten function
  } catch (error) {
    handleError(error, "Initializing maps watcher listener");
    localMapsInitialized.set(true);
    isLoadingLocalMaps.set(false);
    return () => {}; // Return no-op unlistener on error
  }
}
