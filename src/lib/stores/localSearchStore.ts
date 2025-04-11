// src/lib/stores/localMapsSearchStore.ts
import { writable, derived } from "svelte/store";
import { localMapsStore } from "./localMaps";
import { localMapsSearchIndex } from "$lib/utils/localFlexSearch";
import type { LocalMapEntry } from "$lib/ts/fsOperations";

// Store for the current search query.
export const localMapsSearchQuery = writable("");

// Derived store for filtered local maps.
// If the search query is empty, the full localMapsStore data is returned;
// otherwise, the FlexSearch index is used to return search results.
export const localMapsSearchResults = derived(
  [localMapsStore, localMapsSearchQuery],
  ([$localMapsStore, $localMapsSearchQuery], set) => {
    if (!$localMapsSearchQuery.trim()) {
      set($localMapsStore);
      return;
    }
    // Re-index the current local maps.
    localMapsSearchIndex.clear();
    localMapsSearchIndex.add($localMapsStore);
    // Run the search and update the store with the result.
    localMapsSearchIndex
      .search($localMapsSearchQuery)
      .then((results: LocalMapEntry[]) => {
        set(results);
      });
  },
  [] as LocalMapEntry[] // initial empty array.
);
