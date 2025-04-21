// src/lib/stores/mapsStore.ts
import { writable, get } from 'svelte/store'
import { browser } from '$app/environment'
import { listen } from '@tauri-apps/api/event'
import { createFolderStore } from './folderStore'
import { mapsDirectory } from './globalPathsStore'
import { loadLocalMaps } from '$lib/services/fileService'
import { normalizePath } from '$lib/services/pathService'
import { handleError } from '$lib/utils/errorHandler'
import { modioMapsSearchIndex } from '$lib/utils/flexSearchUtils'
import { fetchAllMods } from '$lib/services/modioService'
import type { FsEntry, DirectoryListingResult } from '$lib/types/fsTypes'
import type { Mod } from '$lib/types/modioTypes'

const _localMaps = createFolderStore<FsEntry, DirectoryListingResult>(
  mapsDirectory,
  '',
  loadLocalMaps,
  (res) => res.entries,
)

export const localMaps = _localMaps.entries
export const localMapsLoading = _localMaps.loading
export const localMapsError = _localMaps.error
export const refreshLocalMaps = _localMaps.refresh

const initDir = get(mapsDirectory)?.trim()
if (browser && initDir) {
  _localMaps
    .refresh(initDir, 'Initial load')
    .catch((e) => handleError(e, '[mapsStore] initial load'))
}

mapsDirectory.subscribe((dir) => {
  if (browser && dir?.trim()) {
    _localMaps
      .refresh(dir, 'mapsDirectory change')
      .catch((e) => handleError(e, '[mapsStore] dir change'))
  }
})

if (browser) {
  listen('maps-changed', () => {
    const d = get(mapsDirectory)
    if (d)
      _localMaps
        .refresh(d, 'maps-changed')
        .catch((e) => handleError(e, '[mapsStore] on maps-changed'))
  }).catch((e) => handleError(e, '[mapsStore] attach maps-changed'))

  listen<{ path: string; kind: string }>('rust-fs-change', (evt) => {
    const d = get(mapsDirectory)
    if (d && evt.payload.path.startsWith(normalizePath(d))) {
      _localMaps
        .refresh(d, `FS change: ${evt.payload.kind}`)
        .catch((e) => handleError(e, '[mapsStore] on FS change'))
    }
  }).catch((e) => handleError(e, '[mapsStore] attach FS-change'))
}

export const modioMaps = writable<Mod[]>([])
export const modioMapsLoading = writable(false)
export const modioMapsError = writable<string | null>(null)

export async function refreshModioMaps() {
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
    handleError(e, '[mapsStore] Mod.io refresh')
    modioMapsError.set(e.message ?? String(e))
    modioMaps.set([])
  } finally {
    modioMapsLoading.set(false)
  }
}
