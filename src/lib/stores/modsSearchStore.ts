import type { Mod } from '$lib/types/modioTypes'
import { modioMods } from './modsStore' // ✅ correct store
import { modsSearchIndex } from '$lib/utils/flexSearchUtils'
import { createSearchStore } from './searchStore'
import { writable } from 'svelte/store'

export const modsSortOrder = writable<'recent' | 'popular' | 'downloads'>(
  'recent',
)

const modsSearch = createSearchStore<
  Mod,
  'recent' | 'popular' | 'downloads',
  { id: number }
>(modioMods, modsSearchIndex, {
  sortStore: modsSortOrder,
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
  hitToId: (hit) => String(hit.id),
})

export const modsSearchQuery = modsSearch.query
export const modsSearchSortKey = modsSearch.sortKey!
export const modsSearchResults = modsSearch.results
