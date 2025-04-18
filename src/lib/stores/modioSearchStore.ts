// src/lib/stores/modioSearchStore.ts
import type { Mod } from '$lib/types/modioTypes'
import { modioMaps } from './mapsStore'
import { modioMapsSearchIndex } from '$lib/utils/flexSearchUtils'
import { createSearchStore } from './searchStore'
import { writable } from 'svelte/store'

// keep using your existing sort store
export const modioSortOrder = writable<'recent' | 'popular' | 'downloads'>(
  'recent',
)

const modioSearch = createSearchStore<
  Mod,
  'recent' | 'popular' | 'downloads',
  { id: number }
>(modioMaps, modioMapsSearchIndex, {
  sortStore: modioSortOrder,
  sortFn: (a, b, order) => {
    switch (order) {
      case 'popular':
        return (
          (a.stats?.popularity_rank_position ?? Infinity) -
          (b.stats?.popularity_rank_position ?? Infinity)
        )
      case 'downloads':
        return (b.stats?.downloads_total ?? 0) - (a.stats?.downloads_total ?? 0)
      case 'recent':
      default:
        return (b.date_updated ?? 0) - (a.date_updated ?? 0)
    }
  },
  idField: 'id',
  hitToId: (hit) => String(hit.id), // map StoredModData → string ID
})

export const modioSearchQuery = modioSearch.query
export const modioSearchSortKey = modioSearch.sortKey!
export const modioSearchResults = modioSearch.results
