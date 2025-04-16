// src/lib/stores/mapsStore.ts
import { writable, get } from "svelte/store";
import type { FsEntry } from "$lib/types/fsTypes";
import type { Mod } from "$lib/types/modioTypes";
import { loadLocalMaps } from "$lib/services/fileService";
import { fetchAllMods } from "$lib/services/modioService";
import { mapsDirectory } from "./globalPathsStore";
import { listen } from "@tauri-apps/api/event";
import { handleError } from "$lib/utils/errorHandler";
// ---> Import BOTH index instances <---
import {
  modioMapsSearchIndex,
  localMapsSearchIndex,
} from "$lib/utils/flexSearchUtils";

// --- Data Stores ---
export const localMaps = writable<FsEntry[]>([]);
export const modioMaps = writable<Mod[]>([]);

// --- Separate Loading State Stores ---
export const localMapsLoading = writable<boolean>(false);
export const modioMapsLoading = writable<boolean>(false);

// --- Optional: Separate Error State Stores ---
export const localMapsError = writable<string | null>(null);
export const modioMapsError = writable<string | null>(null);

export async function refreshLocalMaps() {
  const callId = Date.now();
  console.log(
    `[${callId}] Attempting refreshLocalMaps... Current loading: ${get(
      localMapsLoading
    )}`
  );

  if (get(localMapsLoading)) {
    console.log(
      `[${callId}] Local maps refresh already in progress. Skipping.`
    );
    return;
  }

  localMapsLoading.set(true);
  localMapsError.set(null);
  console.log(
    `[${callId}] START refreshLocalMaps, localMapsLoading set to TRUE`
  );

  try {
    const mapsDir = get(mapsDirectory);

    if (!mapsDir || mapsDir.startsWith("/error") || mapsDir.trim() === "") {
      console.warn(
        `[${callId}] Invalid or unconfigured maps directory: '${mapsDir}'. Setting local maps to empty.`
      );
      localMaps.set([]);
      localMapsSearchIndex.clear(); // Clear index if path is invalid
    } else {
      console.log(
        `[${callId}] Calling loadLocalMaps for directory: ${mapsDir}`
      );
      const result = await loadLocalMaps(mapsDir);
      console.log(
        `[${callId}] loadLocalMaps returned. Found ${result.entries.length} entries.`
      );
      localMaps.set(result.entries);

      // ---> Populate the LOCAL search index AFTER data is set <---
      console.log(
        `[${callId}] Clearing and populating Local maps search index...`
      );
      localMapsSearchIndex.clear(); // Clear previous data
      localMapsSearchIndex.add(result.entries); // Add the newly fetched maps
      console.log(`[${callId}] Local maps search index populated.`);
      // ---> END Index Population <---
    }
  } catch (e: any) {
    console.error(`[${callId}] ERROR in refreshLocalMaps:`, e);
    handleError(e, "Refreshing Local Maps");
    localMapsError.set(e instanceof Error ? e.message : String(e));
    localMaps.set([]);
    localMapsSearchIndex.clear(); // Clear index on error
  } finally {
    localMapsLoading.set(false);
    console.log(
      `[${callId}] FINALLY refreshLocalMaps, localMapsLoading set to FALSE`
    );
  }
}

// --- refreshModioMaps remains the same ---
export async function refreshModioMaps() {
  const callId = Date.now();
  console.log(
    `[${callId}] Attempting refreshModioMaps... Current loading: ${get(
      modioMapsLoading
    )}`
  );
  if (get(modioMapsLoading)) {
    console.log(
      `[${callId}] Mod.io maps refresh already in progress. Skipping.`
    );
    return;
  }
  modioMapsLoading.set(true);
  modioMapsError.set(null);
  console.log(
    `[${callId}] START refreshModioMaps, modioMapsLoading set to TRUE`
  );
  try {
    const mods = await fetchAllMods();
    console.log(
      `[${callId}] fetchAllMods returned. Found ${mods.length} mods.`
    );
    modioMaps.set(mods);
    console.log(`[${callId}] Clearing and populating Mod.io search index...`);
    modioMapsSearchIndex.clear();
    modioMapsSearchIndex.add(mods);
    console.log(`[${callId}] Mod.io search index populated.`);
  } catch (e: any) {
    console.error(`[${callId}] ERROR refreshing Mod.io maps:`, e);
    handleError(e, "Refreshing Mod.io Maps");
    modioMapsError.set(e instanceof Error ? e.message : String(e));
    modioMaps.set([]);
    modioMapsSearchIndex.clear();
  } finally {
    modioMapsLoading.set(false);
    console.log(
      `[${callId}] FINALLY refreshModioMaps, modioMapsLoading set to FALSE`
    );
  }
}

// --- mapsDirectory subscription and initializeLocalMapsWatcher remain the same ---
mapsDirectory.subscribe((path) => {
  if (path && !path.startsWith("/error") && path.trim() !== "") {
    console.log(
      `mapsDirectory store changed to: ${path}. Triggering refreshLocalMaps.`
    );
    refreshLocalMaps();
  } else {
    console.log(
      `mapsDirectory store changed to invalid/empty path: ${path}. Skipping auto-refresh.`
    );
  }
});

export async function initializeLocalMapsWatcher(): Promise<() => void> {
  try {
    console.log("Initializing local maps watcher listener...");
    const unlistenFn = await listen("maps-changed", (event) => {
      console.log("Received 'maps-changed' event from backend:", event);
      refreshLocalMaps();
    });
    console.log("Local maps watcher listener initialized successfully.");
    return unlistenFn;
  } catch (error) {
    console.error(
      "Error initializing Tauri event listener for local maps:",
      error
    );
    handleError(error, "Initializing Maps Watcher");
    return () => {
      console.warn(
        "Cleanup function called for maps watcher, but initialization failed."
      );
    };
  }
}
