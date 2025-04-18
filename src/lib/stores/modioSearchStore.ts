// src/lib/stores/modioSearchStore.ts
import { writable, derived, type Readable } from 'svelte/store'
import type { Mod } from '$lib/types/modioTypes'
import { modioMaps } from './mapsStore'
import { modioMapsSearchIndex } from '$lib/utils/flexSearchUtils'
import type { StoredModData } from '$lib/types/searchTypes'

export const modioSearchQuery = writable('')
export const modioSortOrder = writable<'recent' | 'popular' | 'downloads'>(
  'recent',
)

export const modioSearchResults: Readable<Mod[]> = derived(
  [modioSearchQuery, modioMaps, modioSortOrder],
  ([$modioSearchQuery, $modioMaps, $modioSortOrder], set) => {
    const query = $modioSearchQuery.trim().toLowerCase()

    if ($modioMaps.length === 0) {
      set([])
      return
    }

    ;(async () => {
      try {
        let filteredMods: Mod[]

        if (!query) {
          filteredMods = [...$modioMaps]
        } else {
          const searchHits: StoredModData[] =
            await modioMapsSearchIndex.search(query)
          const modMap = new Map($modioMaps.map((mod) => [mod.id, mod]))
          filteredMods = searchHits
            .map((hit) => modMap.get(hit.id))
            .filter((mod): mod is Mod => !!mod)
        }

        filteredMods.sort((a, b) => {
          switch ($modioSortOrder) {
            case 'popular':
              return (
                (a.stats?.popularity_rank_position ?? 999999) -
                (b.stats?.popularity_rank_position ?? 999999)
              )
            case 'downloads':
              return (
                (b.stats?.downloads_total ?? 0) -
                (a.stats?.downloads_total ?? 0)
              )
            case 'recent':
            default:
              return (b.date_updated ?? 0) - (a.date_updated ?? 0)
          }
        })

        set(filteredMods)
      } catch (error) {
        console.error('Error during Mod.io search/sort:', error)
        set([])
      }
    })()
  },
  [] as Mod[],
)
