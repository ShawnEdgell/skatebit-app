import { writable, get } from 'svelte/store'
import { listen } from '@tauri-apps/api/event'
import { createFolderStore } from './folderStore' // Assuming folderStore is updated for source arg
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

// --- Add unique ID for subscription logging ---
const subId = Math.random().toString(36).substring(2, 8)

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
  if (!currentDir) {
    // Log only if skipping AFTER initial skip flag is set
    if (_hasSkippedInitialMapDir)
      console.log(
        `[mapsStore SUB ${subId}] mapsDirectory subscription triggered. Skipping (empty/null dir)`,
      )
    return
  }

  if (!_hasSkippedInitialMapDir) {
    console.log(
      `[mapsStore SUB ${subId}] mapsDirectory subscription: Skipping initial value set ('${currentDir}').`,
    )
    _hasSkippedInitialMapDir = true
    return
  }
  // *** Add subId to log and pass it in source ***
  const source = `mapsDirectory Subscription ${subId}`
  console.log(
    `[mapsStore SUB ${subId}] mapsDirectory changed subsequently to: '${currentDir}'. Triggering refreshLocalMaps.`,
  )
  void refreshLocalMaps(currentDir, source)
})

/**
 * Refresh local maps list. Accepts optional source for logging.
 */
export async function refreshLocalMaps(
  dir?: string,
  source?: string,
): Promise<void> {
  if (_isLoading) {
    console.log(
      `[mapsStore] refreshLocalMaps skipped (already loading). Triggered by: ${source || 'Unknown'}`,
    )
    return
  }
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
    console.warn(
      `[mapsStore] refreshLocalMaps skipped (no valid target directory). Triggered by: ${source || 'Unknown'}`,
    )
    _isLoading = false
    return
  }

  console.log(
    `[mapsStore] refreshLocalMaps EXECUTION START for targetDir: ${targetDir} (Triggered by: ${source || 'Unknown'})`,
  )
  try {
    // Pass the source down to the underlying folderStore refresh
    await _localMaps.refresh(targetDir, source)
    console.log(
      `[mapsStore] refreshLocalMaps finished successfully for: ${targetDir} (Triggered by: ${source || 'Unknown'})`,
    )
  } catch (e: any) {
    console.error(
      `[mapsStore] Error during refreshLocalMaps execution for ${targetDir} (Triggered by: ${source || 'Unknown'}):`,
      e,
    )
    // Error handled deeper, but log here if needed
  } finally {
    _isLoading = false
    console.log(
      `[mapsStore] refreshLocalMaps EXECUTION END for targetDir: ${targetDir} (Triggered by: ${source || 'Unknown'})`,
    )
  }
}

// Listen for Backend Map Changes
if (browser) {
  listen('maps-changed', (event) => {
    const source = 'Rust Event: maps-changed'
    console.log(
      `[mapsStore] Received "${event.event}" event (${source}). Current mapsDir: ${get(mapsDirectory)} (No refresh triggered by listener)`,
    )
    // Refresh call intentionally removed
  })
    .then((unlisten) => {
      console.log('[mapsStore] "maps-changed" listener attached.')
    })
    .catch((e) => {
      handleError(e, 'Attaching maps-changed listener')
    })
}

// Exported Stores for UI Consumption
export const localMaps = _localMaps.entries
export const localMapsLoading = _localMaps.loading
export const localMapsError = _localMaps.error
export const folderMissing = writable(false)

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
  console.log('[mapsStore] Refreshing Mod.io maps...')

  try {
    const mods = await fetchAllMods()
    console.log(`[mapsStore] Fetched ${mods.length} Mod.io maps.`)
    modioMaps.set(mods)
    if (browser) {
      modioMapsSearchIndex.clear()
      modioMapsSearchIndex.add(mods)
      console.log(`[mapsStore] Mod.io maps search index updated.`)
    }
  } catch (e: any) {
    console.error('[mapsStore] Error refreshing Mod.io maps:', e)
    handleError(e, 'Refreshing Mod.io Maps')
    modioMapsError.set(e.message ?? String(e))
    modioMaps.set([])
    if (browser) modioMapsSearchIndex.clear()
  } finally {
    modioMapsLoading.set(false)
    console.log('[mapsStore] Finished refreshing Mod.io maps.')
  }
}
