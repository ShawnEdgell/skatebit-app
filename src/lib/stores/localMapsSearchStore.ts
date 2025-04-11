// src/lib/stores/localSearchStore.ts
import { writable, derived } from "svelte/store";
import { localMapsStore } from "./localMapsStore";
import { localMapsSearchIndex } from "$lib/utils/localFlexSearch";
import type { LocalMapEntry } from "$lib/ts/fsOperations";

export const localMapsSearchQuery = writable("");

export const localMapsSearchResults = derived(
  [localMapsStore, localMapsSearchQuery],
  ([$localMapsStore, $localMapsSearchQuery], set) => {
    if (!$localMapsSearchQuery.trim()) {
      set($localMapsStore);
      return;
    }
    localMapsSearchIndex.clear();
    localMapsSearchIndex.add($localMapsStore);
    localMapsSearchIndex
      .search($localMapsSearchQuery)
      .then((results: LocalMapEntry[]) => {
        set(results);
      });
  },
  [] as LocalMapEntry[]
);
