// src/lib/stores/localMaps.ts
import { writable } from "svelte/store";
import type { LocalMapEntry } from "$lib/ts/fsOperations";
import { loadLocalMapsSimple } from "$lib/ts/fsOperations";
import { baseFolder } from "$lib/ts/fsOperations";
import { normalizePath } from "$lib/ts/pathUtils";

export const localMapsStore = writable<LocalMapEntry[]>([]);

export async function refreshLocalMaps() {
  try {
    // Specify the folder for your maps; for example, baseFolder + "/Maps"
    const localMapsPath = normalizePath(`${baseFolder}/Maps`);
    const maps: LocalMapEntry[] = await loadLocalMapsSimple(localMapsPath);
    localMapsStore.set(maps);
  } catch (err) {
    console.error("Error loading local maps:", err);
  }
}
