// src/lib/stores/localMaps.ts
import { writable } from "svelte/store";
import type { LocalMapEntry } from "$lib/ts/fsOperations";
import { loadLocalMapsSimple } from "$lib/ts/fsOperations";
import { baseFolder } from "$lib/ts/fsOperations";
import { normalizePath } from "$lib/ts/pathUtils";
import { listen } from "@tauri-apps/api/event";

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

let debounceTimeout: ReturnType<typeof setTimeout> | null = null;

export async function initializeLocalMapsWatcher() {
  const unlisten = await listen("maps-changed", () => {
    if (debounceTimeout) clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      refreshLocalMaps();
    }, 250); // adjust if needed
  });
  return unlisten;
}
