// src/lib/stores/mapsStore.ts
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
  '', // pass through
  async (dir) => {
    console.log('[mapsStore] loading local maps from:', dir)
    const { entries } = await loadLocalMaps(dir)
    console.log(`[mapsStore] loaded ${entries.length} entries`)
    return { entries }
  },
  (r) => r.entries,
)

_localMaps.entries.subscribe((all) => {
  localMapsSearchIndex.clear()
  localMapsSearchIndex.add(all)
})

// Refresh on symlink/un‑symlink
mapsDirectory.subscribe((dir) => {
  if (dir && dir.trim()) {
    _localMaps
      .refresh(dir)
      .catch((e) => handleError(e, 'Auto‑refresh Local Maps on path change'))
  }
})

// Refresh on every Rust‑emitted maps‑changed
listen('maps-changed', () => {
  const dir = get(mapsDirectory)
  if (dir && dir.trim()) {
    _localMaps
      .refresh(dir)
      .catch((e) => handleError(e, 'Auto‑refresh Local Maps on maps-changed'))
  }
})

// Exports
export const localMaps = _localMaps.entries
export const localMapsLoading = _localMaps.loading
export const localMapsError = _localMaps.error
export const refreshLocalMaps = _localMaps.refresh

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
