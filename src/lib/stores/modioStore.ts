// src/lib/stores/modioStore.ts
import { get, writable } from "svelte/store";
import type { Mod } from "$lib/types/modio";
import { fetchAllMods, fetchModsPage, sortMods } from "$lib/ts/modApi";
import {
  DISPLAY_PAGE_SIZE,
  FIRESTORE_PAGE_SIZE_ESTIMATE,
} from "$lib/api/modioConstants";
import { handleError } from "$lib/ts/errorHandler";

export type SortOption = "recent" | "popular" | "downloads" | "rating";

function createModioStore() {
  const mods = writable<Mod[]>([]);
  const visibleCount = writable(DISPLAY_PAGE_SIZE);
  const isLoading = writable(false);
  const isFullyLoaded = writable(false);
  const hasMoreToLoad = writable(true);
  const selectedSort = writable<SortOption>("recent");

  async function refresh(): Promise<void> {
    isLoading.set(true);
    try {
      const all = await fetchAllMods();
      mods.set(sortMods(all, get(selectedSort)));
      isFullyLoaded.set(true);
      hasMoreToLoad.set(false);
      visibleCount.set(DISPLAY_PAGE_SIZE);
    } catch (e) {
      handleError(e, "refresh");
      mods.set([]);
    } finally {
      isLoading.set(false);
    }
  }

  async function loadMore(): Promise<void> {
    if (get(isLoading)) return;
    if (get(isFullyLoaded)) {
      visibleCount.update((v) => v + DISPLAY_PAGE_SIZE);
      return;
    }

    isLoading.set(true);
    try {
      const nextPage =
        Math.ceil(get(mods).length / FIRESTORE_PAGE_SIZE_ESTIMATE) + 1;
      const newMods = await fetchModsPage(nextPage);
      if (newMods.length > 0) {
        const current = get(mods);
        const currentIds = new Set(current.map((m) => m.id));
        const unique = newMods.filter((m) => !currentIds.has(m.id));
        mods.set([...current, ...unique]);
        visibleCount.update((v) => v + DISPLAY_PAGE_SIZE);
      } else {
        hasMoreToLoad.set(false);
      }
    } catch (e) {
      handleError(e, "loadMore");
    } finally {
      isLoading.set(false);
    }
  }

  function sort(sortValue: SortOption): void {
    selectedSort.set(sortValue);
    const current = get(mods);
    mods.set(sortMods(current, sortValue));
    visibleCount.set(DISPLAY_PAGE_SIZE);
  }

  return {
    mods,
    visibleCount,
    isLoading,
    selectedSort,
    refresh,
    loadMore,
    sort,
  };
}

export const modioStore = createModioStore();
