// src/lib/stores/localMapsSearchStore.ts
import { writable, derived } from "svelte/store";
import { localMapsStore } from "./localMapsStore";
import { localMapsSearchIndex } from "$lib/utils/localFlexSearch";
// *** Change import and type usage to FsEntry ***
import type { FsEntry } from "$lib/ts/fsOperations";

export const localMapsSearchQuery = writable("");

// Ensure the derived store works with FsEntry[]
export const localMapsSearchResults = derived<
  [typeof localMapsStore, typeof localMapsSearchQuery],
  FsEntry[] // Output type is FsEntry[]
>(
  [localMapsStore, localMapsSearchQuery],
  ([$localMapsStore, $localMapsSearchQuery], set) => {
    const query = $localMapsSearchQuery.trim();
    if (!query) {
      set($localMapsStore); // No query, return all maps
      return;
    }

    // Debounce or handle async setting carefully if index is large
    // Assuming localMapsSearchIndex is configured for FsEntry structure
    localMapsSearchIndex.clear();
    localMapsSearchIndex.add($localMapsStore); // Add FsEntry[] to index
    localMapsSearchIndex
      .search(query) // Perform search
      .then((results: FsEntry[]) => {
        // Expect FsEntry[] results
        set(results);
      })
      .catch((err) => {
        console.error("Error during local maps search:", err);
        set([]); // Set empty on error
      });
  },
  [] as FsEntry[] // Initial value is empty FsEntry[]
);
