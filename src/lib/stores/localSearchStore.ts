// src/lib/stores/localSearchStore.ts
import type { FsEntry } from '$lib/types/fsTypes'
import { localMaps } from './mapsStore'
import { localMapsSearchIndex } from '$lib/utils/flexSearchUtils'
import { createSearchStore } from './searchStore'

const localSearch = createSearchStore<FsEntry>(
  localMaps,
  localMapsSearchIndex,
  {
    // FsEntry has no `.id`, so use `.path` as the unique key:
    idField: 'path',
  },
)

export const localSearchQuery = localSearch.query
export const localSearchResults = localSearch.results
