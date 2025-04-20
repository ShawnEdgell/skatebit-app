import { writable, get } from 'svelte/store'
import { listen } from '@tauri-apps/api/event'
import { createFolderStore } from './folderStore'
import { mapsDirectory } from './globalPathsStore'
import { loadLocalMaps } from '$lib/services/fileService'
import type { FsEntry } from '$lib/types/fsTypes'
import { handleError } from '$lib/utils/errorHandler'
import {
  localMapsSearchIndex,
  modioMapsSearchIndex,
} from '$lib/utils/flexSearchUtils'
import { fetchAllMods } from '$lib/services/modioService'
import type { Mod } from '$lib/types/modioTypes'

// 1) LOCAL MAPS store
const _localMaps = createFolderStore<FsEntry, { entries: FsEntry[] }>(
  mapsDirectory,
  '', // pass through raw path
  async (dir) => {
    console.log('[mapsStore] loading local maps from:', dir)
    const { entries } = await loadLocalMaps(dir)
    console.log(`[mapsStore] loaded ${entries.length} entries`)
    return { entries }
  },
  (r) => r.entries,
)

// Keep a search index up to date
_localMaps.entries.subscribe((all) => {
  localMapsSearchIndex.clear()
  localMapsSearchIndex.add(all)
})

// --- Prevent double-calls on startup ---
let _hasSkippedInitial = false
let _isLoading = false

mapsDirectory.subscribe((dir) => {
  if (!dir?.trim()) return

  // The very first real path is bootstrapped from +layout, skip it here
  if (!_hasSkippedInitial) {
    _hasSkippedInitial = true
    return
  }

  // On any subsequent path change, refresh
  refreshLocalMaps(dir)
})

/**
 * Refresh local maps once, ignoring overlapping requests
 */
export async function refreshLocalMaps(dir?: string): Promise<void> {
  if (_isLoading) return
  _isLoading = true
  try {
    await _localMaps.refresh(dir ?? get(mapsDirectory))
  } catch (e: any) {
    handleError(e, 'Refreshing Local Maps')
  } finally {
    _isLoading = false
  }
}

// Also reload when Tauri emits a `maps-changed` event
listen('maps-changed', () => {
  const dir = get(mapsDirectory)
  if (dir?.trim()) {
    refreshLocalMaps(dir)
  }
})

// Exports for in-app consumption
export const localMaps = _localMaps.entries
export const localMapsLoading = _localMaps.loading
export const localMapsError = _localMaps.error

// 2) REMOTE MAPS (Mod.io)
export const modioMaps = writable<Mod[]>([])
export const modioMapsLoading = writable<boolean>(false)
export const modioMapsError = writable<string | null>(null)

export async function refreshModioMaps(): Promise<void> {
  if (get(modioMapsLoading)) return
  modioMapsLoading.set(true)
  modioMapsError.set(null)

  try {
    const mods = await fetchAllMods()
    modioMaps.set(mods)
    modioMapsSearchIndex.clear()
    modioMapsSearchIndex.add(mods)
  } catch (e: any) {
    handleError(e, 'Refreshing Mod.io Maps')
    modioMapsError.set(e.message ?? String(e))
    modioMaps.set([])
    modioMapsSearchIndex.clear()
  } finally {
    modioMapsLoading.set(false)
  }
}
