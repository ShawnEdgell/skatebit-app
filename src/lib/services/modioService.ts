// src/lib/services/modioService.ts
import { db } from "$lib/firebase/firebase";
import { doc, getDoc } from "firebase/firestore";
import type { Mod } from "$lib/types/modioTypes";
import type { FsEntry } from "$lib/types/fsTypes";
import { handleError } from "$lib/utils/errorHandler";
import { FIRESTORE_PAGE_SIZE_ESTIMATE } from "$lib/api/modioConstants";

// Filter out mods that have a "console" tag
const filterConsoleMods = (mod: Mod): boolean => {
  return !mod.tags?.some((tag) => tag.name.toLowerCase() === "console");
};

export const fetchModsPage = async (page: number): Promise<Mod[]> => {
  try {
    const snapshot = await getDoc(doc(db, "mods", `page_${page}`));
    if (snapshot.exists()) {
      const data = snapshot.data();
      const mods = Array.isArray(data?.mods) ? data.mods : [];
      return mods.filter(filterConsoleMods);
    }
  } catch (error) {
    handleError(error, `fetchModsPage (page ${page})`);
  }
  return [];
};

export const fetchAllMods = async (): Promise<Mod[]> => {
  let allMods: Mod[] = [];
  let page = 1;
  let fetching = true;
  const maxPages = 50;
  while (fetching && page <= maxPages) {
    console.log(`Fetching mods page ${page}...`);
    const pageMods = await fetchModsPage(page);
    console.log(`Fetched ${pageMods.length} mods from page ${page}.`);
    allMods = [...allMods, ...pageMods];
    if (
      pageMods.length < FIRESTORE_PAGE_SIZE_ESTIMATE * 0.8 ||
      pageMods.length === 0
    ) {
      console.log(`Stopping fetch loop: Fetched ${pageMods.length} mods.`);
      fetching = false;
    }
    page++;
  }
  console.log(`Finished fetching. Total mods: ${allMods.length}`);
  return allMods;
};

const sortMap = {
  recent: (a: Mod, b: Mod) => (b.date_added ?? 0) - (a.date_added ?? 0),
  popular: (a: Mod, b: Mod) =>
    (a.stats?.popularity_rank_position ?? Infinity) -
    (b.stats?.popularity_rank_position ?? Infinity),
  downloads: (a: Mod, b: Mod) =>
    (b.stats?.downloads_total ?? 0) - (a.stats?.downloads_total ?? 0),
};

export type SortType = keyof typeof sortMap;

export const sortMods = (mods: Mod[], sortType: SortType): Mod[] =>
  mods.slice().sort(sortMap[sortType]);

export function mapModToFsEntry(mod: Mod): FsEntry {
  return {
    name: mod.name,
    path: `/modio/${mod.id}`,
    isDirectory: false,
    size: mod.modfile?.filesize ?? null,
    modified: mod.date_updated,
    thumbnailPath: mod.logo?.thumb_320x180 ?? null,
    thumbnailMimeType: null, // or set appropriately
  };
}

export async function fetchAllModsAsFsEntries(): Promise<FsEntry[]> {
  const mods = await fetchAllMods();
  return mods.map(mapModToFsEntry);
}
