import { derived, writable } from 'svelte/store';
import { modioMaps } from './mapsStore';
import { modioMapsSearchIndex } from '$lib/utils/flexSearchUtils';
import { sortMaps } from '$lib/services/modioCacheService';
import type { Mod } from '$lib/types/modioTypes';

export const modioSearchQuery = writable('');

export type ModioSortValue = 'recent' | 'popular' | 'downloads';
export const modioSortOrder = writable<ModioSortValue>('recent');

export const modioSearchResults = derived(
  [modioMaps, modioSearchQuery, modioSortOrder],
  ([$modioMaps, $query, $sortOrder], set) => {
    
    const performSearch = async () => {
      if ($query.trim()) {
        const hits = await modioMapsSearchIndex.search($query);
        const hitIds = new Set(hits.map(h => h.id));
        const filteredMaps = $modioMaps.filter(mod => hitIds.has(mod.id));
        set(sortMaps(filteredMaps, $sortOrder));
      } else {
        set(sortMaps($modioMaps, $sortOrder));
      }
    };

    performSearch();
    
  },
  [] as Mod[]
);
