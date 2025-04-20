import type { FsEntry } from '$lib/types/fsTypes'
import { localMaps } from './mapsStore'
import { createSearchStore } from './searchStore'
import { localMapsSearchIndex } from '$lib/utils/flexSearchUtils'

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
