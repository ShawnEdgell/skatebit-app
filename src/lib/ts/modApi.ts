// src/lib/ts/modApi.ts
import { db } from "$lib/firebase/firebase";
import { doc, getDoc } from "firebase/firestore";
import type { Mod } from "$lib/types/modio";
import {
  DISPLAY_PAGE_SIZE,
  FIRESTORE_PAGE_SIZE_ESTIMATE,
} from "$lib/api/constants";
import { handleError } from "./errorHandler";

/**
 * Filters out mods that include unwanted keywords (e.g., console-specific mods).
 */
export function filterConsoleMods(mod: Mod): boolean {
  const text = `${(mod.name || "").toLowerCase()} ${(
    mod.summary || ""
  ).toLowerCase()}`;
  return !/(ps4|playstation|xbox)/i.test(text);
}

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
export function sortMods(mods: Mod[], sortType: string): Mod[] {
  const sortedMods = [...mods];
  switch (sortType) {
    case "recent":
      sortedMods.sort((a, b) => (b.date_added ?? 0) - (a.date_added ?? 0));
      break;
    case "popular":
      sortedMods.sort(
        (a, b) =>
          (a.stats?.popularity_rank_position ?? Infinity) -
          (b.stats?.popularity_rank_position ?? Infinity)
      );
      break;
    case "downloads":
      sortedMods.sort(
        (a, b) =>
          (b.stats?.downloads_total ?? 0) - (a.stats?.downloads_total ?? 0)
      );
      break;
    case "rating":
      sortedMods.sort(
        (a, b) =>
          (b.stats?.ratings_weighted_aggregate ?? 0) -
          (a.stats?.ratings_weighted_aggregate ?? 0)
      );
      break;
    default:
      break;
  }
  return sortedMods;
}
