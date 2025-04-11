// src/lib/stores/localMaps.ts
import { writable } from "svelte/store";
import type { LocalMapEntry } from "$lib/ts/fsOperations";
import { loadLocalMapsSimple } from "$lib/ts/fsOperations";
import { baseFolder } from "$lib/ts/fsOperations";
import { normalizePath } from "$lib/ts/pathUtils";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

export const localMapsStore = writable<LocalMapEntry[]>([]);
export const localMapsInitialized = writable<boolean>(false);

export async function refreshLocalMaps() {
  try {
    const localMapsPath = normalizePath(`${baseFolder}/Maps`);
    const maps: LocalMapEntry[] = await loadLocalMapsSimple(localMapsPath);
    localMapsStore.set(maps);
    localMapsInitialized.set(true);
  } catch (err) {
    console.error("Error loading local maps:", err);
    localMapsInitialized.set(true); // even if there is an error, mark as initialized
  }
}

// Initialize the file watcher and set up event listener once.
export async function initializeLocalMapsWatcher() {
  await invoke("start_maps_watcher");
  const unlisten = await listen("maps-changed", () => {
    refreshLocalMaps();
  });
  return unlisten;
}
