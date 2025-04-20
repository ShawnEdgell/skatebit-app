import { writable, get } from 'svelte/store'
import { listen } from '@tauri-apps/api/event'
import { createFolderStore } from './folderStore'
import { mapsDirectory } from './globalPathsStore'
import { loadLocalMaps } from '$lib/services/fileService'
import type { FsEntry, DirectoryListingResult } from '$lib/types/fsTypes'
import { ListingStatus } from '$lib/types/fsTypes'
import { handleError } from '$lib/utils/errorHandler'
import {
  localMapsSearchIndex,
  modioMapsSearchIndex,
} from '$lib/utils/flexSearchUtils'
import { fetchAllMods } from '$lib/services/modioService'
import type { Mod } from '$lib/types/modioTypes'
import { browser } from '$app/environment'

// Local Maps Store Setup
const _localMaps = createFolderStore<FsEntry, DirectoryListingResult>(
  mapsDirectory,
  '',
  async (dir): Promise<DirectoryListingResult> => {
    try {
      const result = await loadLocalMaps(dir)
      folderMissing.set(result.status === ListingStatus.DoesNotExist)
      return result
    } catch (error) {
      handleError(error, `Loading maps from ${dir}`)
      folderMissing.set(true)
      // Return structure indicating failure/non-existence
      // Ensure the 'path' matches the expected string type if DirectoryListingResult TS type uses string
      return {
        status: ListingStatus.DoesNotExist,
        entries: [],
        path: dir || '',
      }
    }
  },
  (result: DirectoryListingResult): FsEntry[] => {
    return result.status === ListingStatus.DoesNotExist ? [] : result.entries
  },
)

// FlexSearch Indexing for Local Maps
_localMaps.entries.subscribe((all) => {
  if (browser && all) {
    try {
      localMapsSearchIndex.clear()
      localMapsSearchIndex.add(all)
    } catch (indexError) {
      console.error(
        `[mapsStore] FlexSearch: Failed to update index:`,
        indexError,
      )
      handleError(indexError, 'Updating local maps search index')
      localMapsSearchIndex.clear()
    }
  }
})

// Refresh Debouncing
let _isLoading = false

// React to Maps Directory Changes
let _hasSkippedInitialMapDir = false
mapsDirectory.subscribe((dir) => {
  if (!browser) return
  const currentDir = dir ? dir.trim() : ''
  if (!currentDir) return

  if (!_hasSkippedInitialMapDir) {
    _hasSkippedInitialMapDir = true
    return
  }
  // Use void or catch to handle promise
  void refreshLocalMaps(currentDir)
})

/**
 * Refresh local maps list.
 */
export async function refreshLocalMaps(dir?: string): Promise<void> {
  if (_isLoading) return
  _isLoading = true

  let targetDir: string | null = null
  const providedDir = dir ? dir.trim() : ''
  const currentStoredDir = get(mapsDirectory)?.trim() ?? ''

  if (providedDir) {
    targetDir = providedDir
  } else if (currentStoredDir) {
    targetDir = currentStoredDir
  }

  if (!targetDir) {
    _isLoading = false
    return
  }

  try {
    await _localMaps.refresh(targetDir)
  } catch (e: any) {
    // Error should be handled within createFolderStore's loaderFn now
    // handleError(e, `Refreshing Local Maps for ${targetDir}`); // Likely redundant
  } finally {
    _isLoading = false
  }
}

// Listen for Backend Map Changes (but don't trigger redundant refresh)
if (browser) {
  listen('maps-changed', (event) => {
    console.log(
      '[mapsStore] Received "maps-changed" event (refresh handled by subscription):',
      event,
    )
    // REMOVED: refreshLocalMaps(dir);
    // Refresh is now handled by the mapsDirectory subscription when the path changes,
    // or explicitly by frontend logic (like DnD handler) after operations.
    // Keeping the listener might be useful for other future reactions or logging.
  })
    .then((unlisten) => {
      // Optional cleanup if needed, though usually module-level listeners persist
    })
    .catch((e) => {
      handleError(e, 'Attaching maps-changed listener')
    })
}

// Exported Stores for UI Consumption
export const localMaps = _localMaps.entries
export const localMapsLoading = _localMaps.loading
export const localMapsError = _localMaps.error
export const folderMissing = writable(false) // State for indicating if the folder is missing

// Mod.io Maps Store Setup (Remote)
export const modioMaps = writable<Mod[]>([])
export const modioMapsLoading = writable<boolean>(false)
export const modioMapsError = writable<string | null>(null)

/**
 * Refresh mod.io maps list.
 */
export async function refreshModioMaps(): Promise<void> {
  if (get(modioMapsLoading)) return
  modioMapsLoading.set(true)
  modioMapsError.set(null)

  try {
    const mods = await fetchAllMods()
    modioMaps.set(mods)
    if (browser) {
      // Indexing only in browser
      modioMapsSearchIndex.clear()
      modioMapsSearchIndex.add(mods)
    }
  } catch (e: any) {
    handleError(e, 'Refreshing Mod.io Maps')
    modioMapsError.set(e.message ?? String(e))
    modioMaps.set([])
    if (browser) modioMapsSearchIndex.clear()
  } finally {
    modioMapsLoading.set(false)
  }
}
