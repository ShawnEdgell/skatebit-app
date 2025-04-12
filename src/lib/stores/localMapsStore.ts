// src/lib/stores/localMapsStore.ts
import { writable, get } from "svelte/store";
import type { FsEntry } from "$lib/ts/fsOperations";
import { loadLocalMapsSimple, baseFolder } from "$lib/ts/fsOperations"; // Import baseFolder
import { normalizePath } from "$lib/ts/pathUtils";
import { listen } from "@tauri-apps/api/event";
// import { mapsFolder } from "$lib/stores/mapsFolderStore"; // Don't use absolute path store here

export const localMapsStore = writable<FsEntry[]>([]);
export const localMapsInitialized = writable<boolean>(false);
export const isLoadingLocalMaps = writable<boolean>(false);

export async function refreshLocalMaps() {
  if (get(isLoadingLocalMaps)) {
    // console.log("Refresh already in progress, skipping."); // Optional log
    return;
  }
  isLoadingLocalMaps.set(true);

  try {
    // *** Use the RELATIVE base folder path ***
    // Construct the relative path needed by loadLocalMapsSimple/Rust command
    const mapsRootRelativePath = normalizePath(`${baseFolder}/Maps`); // e.g., "SkaterXL/Maps"

    // *** REMOVED - Don't get absolute path from store for this call ***
    // const mapsRootAbsolutePath = get(mapsFolder);
    // if (!mapsRootAbsolutePath) { ... }

    console.log(
      `Refreshing local maps using RELATIVE path: ${mapsRootRelativePath}`
    );
    // Call with the relative path
    const maps: FsEntry[] = await loadLocalMapsSimple(mapsRootRelativePath);

    // *** ADD LOG before setting store ***
    console.log(
      "[Store] Data before setting store:",
      JSON.parse(JSON.stringify(maps))
    );
    const hasBadData = maps.some(
      (m) => m == null || !m.path || m.name === undefined
    ); // Check path again
    if (hasBadData) {
      console.error(
        "[Store] !!! ERROR !!! Attempting to set store with bad data (missing path/name)!",
        maps.filter((m) => !m?.path)
      );
    }
    localMapsStore.set(maps); // Set the potentially corrected data

    localMapsInitialized.set(true);
    console.log(
      `[Store] Local maps store refreshed with ${maps.length} entries.`
    );
  } catch (err) {
    console.error("Error refreshing local maps store:", err);
    localMapsStore.set([]);
    localMapsInitialized.set(true);
  } finally {
    isLoadingLocalMaps.set(false);
  }
}

// Initialize the file watcher and set up event listener once.
export async function initializeLocalMapsWatcher() {
  // Consider calling refreshLocalMaps once initially when watcher starts,
  // AFTER the maps folder path is likely set.
  // await refreshLocalMaps();

  console.log("Initializing local maps watcher...");
  const unlisten = await listen("maps-changed", (event) => {
    console.log("Received maps-changed event:", event.payload);
    refreshLocalMaps(); // Refresh when Rust signals changes
  });
  console.log("Local maps watcher initialized.");

  // Return the unlisten function for cleanup when the app/component unmounts
  return unlisten;
}
