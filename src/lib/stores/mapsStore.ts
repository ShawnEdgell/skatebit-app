// src/lib/stores/mapsStore.ts
import {
  writable,
  get,
  derived,
  type Readable,
  type Writable,
} from 'svelte/store'
import { listen } from '@tauri-apps/api/event'
import { mapsDirectory } from './globalPathsStore'
import { normalizePath } from '$lib/services/pathService'
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
import { createFolderStore } from './folderStore'
import { loadLocalMaps } from '$lib/services/fileService'

// --- Local Maps (on‑disk) --------------------------------------------------

// folderStore handles caching, loading, etc.
const _localMaps = createFolderStore<FsEntry, DirectoryListingResult>(
  mapsDirectory,
  '',
  async (dir): Promise<DirectoryListingResult> => {
    const result = await loadLocalMaps(dir)
    return result
  },
  (result): FsEntry[] => result.entries,
)

// keep a debounced loading flag
export const localMapsLoading = _localMaps.loading
export const localMapsError = _localMaps.error
export const localMaps = _localMaps.entries

// Rebuild FlexSearch index whenever the entries array changes
localMaps.subscribe((all) => {
  if (browser) {
    try {
      localMapsSearchIndex.clear()
      localMapsSearchIndex.add(all)
    } catch (e) {
      handleError(e, '[mapsStore] Indexing local maps')
      localMapsSearchIndex.clear()
    }
  }
})

// Fire a fresh load of localMaps
export async function refreshLocalMaps(): Promise<void> {
  const dir = get(mapsDirectory)?.trim()
  if (dir) {
    try {
      await _localMaps.refresh(dir)
    } catch (e) {
      // Already handled/logged in folderStore
    }
  }
}

// Whenever the user changes the mapsDirectory in settings, reload
mapsDirectory.subscribe((dir) => {
  if (browser && dir?.trim()) {
    void refreshLocalMaps()
  }
})

// ===== add these listeners! =====
if (browser) {
  // 1) whenever we manually emit `maps-changed` in Rust commands
  listen('maps-changed', () => {
    void refreshLocalMaps()
  }).catch((e) => handleError(e, '[mapsStore] Attaching maps-changed listener'))

  // 2) whenever the Rust watcher emits a fs‑change anywhere
  listen<{ path: string; kind: string }>('rust-fs-change', (event) => {
    const dir = get(mapsDirectory)
    if (dir && event.payload.path.startsWith(normalizePath(dir))) {
      void refreshLocalMaps()
    }
  }).catch((e) =>
    handleError(e, '[mapsStore] Attaching rust-fs-change listener'),
  )
}

// --- Mod.io Maps (remote) --------------------------------------------------

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
    if (browser) {
      modioMapsSearchIndex.clear()
      modioMapsSearchIndex.add(mods)
    }
  } catch (e: any) {
    handleError(e, '[mapsStore] Refreshing Mod.io Maps')
    modioMapsError.set(e.message ?? String(e))
    modioMaps.set([])
  } finally {
    modioMapsLoading.set(false)
  }
}
