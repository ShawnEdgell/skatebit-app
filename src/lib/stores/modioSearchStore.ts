// src/lib/stores/modSearchStore.ts
import { writable, derived } from "svelte/store";
import { modioStore } from "./modioStore";
import { modSearchIndex } from "$lib/utils/modioFlexSearch";
import type { Mod } from "$lib/types/modio";

// Store to hold the current mod search query.
export const modSearchQuery = writable("");

// Derived store that produces search results using the mod search index.
export const modSearchResults = derived(
  [modioStore.mods, modSearchQuery],
  ([$mods, $modSearchQuery], set) => {
    // If the query is empty, return the full mod list.
    if (!$modSearchQuery.trim()) {
      set($mods);
      return;
    }

    // Rebuild the index with the current mods.
    modSearchIndex.clear();
    modSearchIndex.add($mods);

    // Run the search and update the store.
    modSearchIndex.search($modSearchQuery).then((results) => {
      set(results);
    });
  },
  [] as Mod[] // initial value
);
