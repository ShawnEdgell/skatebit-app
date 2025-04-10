// src/lib/ts/modApi.ts
import { db } from "$lib/firebase/firebase";
import { doc, getDoc } from "firebase/firestore";
import type { Mod } from "$lib/types/modio";
import { FIRESTORE_PAGE_SIZE_ESTIMATE } from "$lib/api/modioConstants";
import { handleError } from "./errorHandler";
import { filterConsoleMods } from "./modUtils";

const sortMap = {
  recent: (a: Mod, b: Mod) => (b.date_added ?? 0) - (a.date_added ?? 0),
  popular: (a: Mod, b: Mod) =>
    (a.stats?.popularity_rank_position ?? Infinity) -
    (b.stats?.popularity_rank_position ?? Infinity),
  downloads: (a: Mod, b: Mod) =>
    (b.stats?.downloads_total ?? 0) - (a.stats?.downloads_total ?? 0),
  rating: (a: Mod, b: Mod) =>
    (b.stats?.ratings_weighted_aggregate ?? 0) -
    (a.stats?.ratings_weighted_aggregate ?? 0),
};

type SortType = keyof typeof sortMap; // This ensures that only the valid keys of `sortMap` are allowed

/**
 * Fetches mods for a given page from Firestore.
 */
export async function fetchModsPage(page: number): Promise<Mod[]> {
  const docRef = doc(db, "mods", `page_${page}`);
  try {
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      const data = snapshot.data();
      if (data.mods && Array.isArray(data.mods)) {
        return data.mods.filter(filterConsoleMods);
      }
    }
  } catch (error) {
    handleError(error, `fetchModsPage (page ${page})`);
  }
  return [];
}

/**
 * Fetches all mods by looping through pages until the last page is reached.
 */
export async function fetchAllMods(): Promise<Mod[]> {
  let allMods: Mod[] = [];
  let page = 1;
  let continueFetching = true;
  while (continueFetching) {
    try {
      const pageMods = await fetchModsPage(page);
      if (pageMods.length > 0) {
        allMods = [...allMods, ...pageMods];
      }
      if (pageMods.length < FIRESTORE_PAGE_SIZE_ESTIMATE * 0.8) {
        continueFetching = false;
      }
      page++;
      if (page > 50) {
        console.warn("Breaking fetchAllMods loop due to page limit");
        break;
      }
    } catch (error) {
      handleError(error, "fetchAllMods loop");
      continueFetching = false;
    }
  }
  return allMods;
}

/**
 * Sorts the mods array based on a provided sort type.
 */
export function sortMods(mods: Mod[], sortType: SortType): Mod[] {
  const sortedMods = [...mods];
  sortedMods.sort(sortMap[sortType]); // Accessing sortMap with a valid key
  return sortedMods;
}
