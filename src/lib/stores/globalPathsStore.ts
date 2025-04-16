// src/lib/stores/globalPathsStore.ts
import { writable } from "svelte/store";
import { resolveDocPath } from "$lib/services/pathService";

// For maps only – used exclusively by the maps feature.
export const mapsDirectory = writable<string>("");
// Flag indicating whether the maps folder is custom (symlinked).
export const isMapsSymlinked = writable<boolean>(false);

// For the file explorer – the base folder for file browsing (e.g., the entire SkaterXL folder).
export const explorerDirectory = writable<string>("");

/**
 * Initializes mapsDirectory.
 * Checks localStorage for a custom maps folder.
 * If not found, uses the default (Documents/SkaterXL/Maps).
 */
export async function initializeGlobalPaths() {
  const storedMaps = localStorage.getItem("customMapsDirectory");
  if (storedMaps && storedMaps.trim() !== "") {
    console.log(
      "[GlobalPathsStore] Loaded custom mapsDirectory from localStorage:",
      storedMaps
    );
    mapsDirectory.set(storedMaps);
    isMapsSymlinked.set(true);
  } else {
    const defaultMapsPath = await resolveDocPath("SkaterXL", "Maps");
    console.log(
      "[GlobalPathsStore] No custom maps found in localStorage, using default:",
      defaultMapsPath
    );
    mapsDirectory.set(defaultMapsPath || "");
    isMapsSymlinked.set(false);
  }
}

/**
 * Initializes explorerDirectory.
 */
export async function initializeExplorerPaths() {
  const defaultExplorerPath = await resolveDocPath("SkaterXL");
  console.log(
    "[GlobalPathsStore] Explorer directory set to:",
    defaultExplorerPath
  );
  explorerDirectory.set(defaultExplorerPath || "");
}

// Persist mapsDirectory to localStorage whenever its value changes.
mapsDirectory.subscribe((value) => {
  if (value && value.trim() !== "") {
    localStorage.setItem("customMapsDirectory", value);
    console.log(
      "[GlobalPathsStore] Saved mapsDirectory to localStorage:",
      value
    );
  } else {
    console.warn(
      "[GlobalPathsStore] mapsDirectory is empty; not saving to localStorage."
    );
  }
});
