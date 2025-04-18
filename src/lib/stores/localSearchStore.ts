// src/lib/stores/localSearchStore.ts
import { writable, derived, type Readable } from 'svelte/store'
import { localMaps } from './mapsStore' // Still need base data for the "no query" case
import { localMapsSearchIndex } from '$lib/utils/flexSearchUtils'
import type { FsEntry } from '$lib/types/fsTypes'

export const localSearchQuery = writable<string>('')

export const localSearchResults: Readable<FsEntry[]> = derived(
  // Only depends on query now for triggering search, but keep localMaps for the empty query case
  [localSearchQuery, localMaps],
  ([$localSearchQuery, $localMaps], set: (value: FsEntry[]) => void) => {
    const query = $localSearchQuery.trim().toLowerCase() // Normalize query

    if (!query) {
      set($localMaps) // Return all maps if query is empty
      return
    }

    // Query is not empty, perform the search asynchronously
    ;(async () => {
      try {
        const results: FsEntry[] = await localMapsSearchIndex.search(query)
        set(results)
      } catch (error) {
        console.error('Error during Local maps search:', error)
        set([]) // Set empty on error
      }
    })()
  },
  [] as FsEntry[], // Initial value
)
