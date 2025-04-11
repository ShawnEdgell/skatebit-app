// src/lib/stores/modioMaps.ts
import { writable } from "svelte/store";
import type { Mod } from "$lib/types/modio";
import { fetchAllMods } from "$lib/ts/modApi";

// Create a writable store for mod.io maps.
export const modioMapsStore = writable<Mod[]>([]);

// Function to refresh mod.io maps
export async function refreshModioMaps() {
  try {
    const mods: Mod[] = await fetchAllMods();
    modioMapsStore.set(mods);
  } catch (error) {
    console.error("Error loading mod.io maps:", error);
  }
}
