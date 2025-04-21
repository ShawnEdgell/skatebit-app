// src/lib/stores/mapsStore.ts
import { writable, get } from 'svelte/store'
import { browser } from '$app/environment'
import { listen } from '@tauri-apps/api/event'
import { createFolderStore } from './folderStore'
import { mapsDirectory } from './globalPathsStore'
import { loadLocalMaps } from '$lib/services/fileService'
import { fetchAllMods } from '$lib/services/modioService'
import { normalizePath } from '$lib/services/pathService'
import { handleError } from '$lib/utils/errorHandler'
import {
  localMapsSearchIndex,
  modioMapsSearchIndex,
} from '$lib/utils/flexSearchUtils'
import type { FsEntry, DirectoryListingResult } from '$lib/types/fsTypes'
import type { Mod } from '$lib/types/modioTypes'

// ── Local disk maps ──────────────────────────────────────────────────────────
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

// kick off an initial load if mapsDirectory was already set
const initDir = get(mapsDirectory)?.trim()
if (browser && initDir) {
  _localMaps
    .refresh(initDir, 'Initial load')
    .catch((e) => handleError(e, '[mapsStore] Initial local maps load'))
}

// reload when user changes mapsDirectory
mapsDirectory.subscribe((dir) => {
  const d = dir?.trim()
  if (browser && d) {
    _localMaps
      .refresh(d, 'mapsDirectory change')
      .catch((e) =>
        handleError(e, '[mapsStore] Refresh on mapsDirectory change'),
      )
  }
})

// listen for our new Rust events
if (browser) {
  // manual “maps-changed” (you can remove this once you stop emitting it entirely)
  listen('maps-changed', () => {
    const dir = get(mapsDirectory)
    if (dir) {
      _localMaps
        .refresh(dir, 'maps-changed')
        .catch((e) => handleError(e, '[mapsStore] Refresh on maps-changed'))
    }
  }).catch((e) => handleError(e, '[mapsStore] Attaching maps-changed listener'))

  // low‑level FS watcher events
  listen<{ path: string; kind: string }>('rust-fs-change', (evt) => {
    const dir = get(mapsDirectory)
    if (dir && evt.payload.path.startsWith(normalizePath(dir))) {
      _localMaps
        .refresh(dir, `FS change: ${evt.payload.kind}`)
        .catch((e) => handleError(e, '[mapsStore] Refresh on FS change'))
    }
  }).catch((e) =>
    handleError(e, '[mapsStore] Attaching rust-fs-change listener'),
  )
}

// ── Remote Mod.io maps ───────────────────────────────────────────────────────
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
