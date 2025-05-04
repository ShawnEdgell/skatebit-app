import { writable, get } from 'svelte/store'
import { browser } from '$app/environment'
import { listen } from '@tauri-apps/api/event'
import { mapsDirectory } from './globalPathsStore'
import { loadLocalMaps } from '$lib/services/fileService'
import { normalizePath } from '$lib/services/pathService'
import { handleError } from '$lib/utils/errorHandler'
import { modioMapsSearchIndex } from '$lib/utils/flexSearchUtils'
import { fetchAllModioItems } from '$lib/services/modioCacheService'
import type { FsEntry, DirectoryListingResult } from '$lib/types/fsTypes'
import type { Mod } from '$lib/types/modioTypes'

// local maps
export const localMaps = writable<FsEntry[]>([])
export const localMapsLoading = writable(false)
export const localMapsError = writable<string | null>(null)

let manualUpdateInProgress = false
let isLoadingLocal = false
let lastDir = ''
let allowAutoLoad = true
let hasInitialized = false

export function suppressAutoLoad() {
  allowAutoLoad = false
}

export function resumeAutoLoad() {
  allowAutoLoad = true
}

function markManualUpdate() {
  manualUpdateInProgress = true
}

/** Centralized load logic */
async function _loadLocal(dir: string, source = 'unknown') {
  console.log(`[mapsStore] Loading local maps from ${source}:`, dir)
  if (!allowAutoLoad || isLoadingLocal) return
  isLoadingLocal = true
  localMapsLoading.set(true)
  localMapsError.set(null)
  try {
    const res = (await loadLocalMaps(
      normalizePath(dir),
    )) as DirectoryListingResult
    localMaps.set(res.entries)
  } catch (e: any) {
    handleError(e, '[mapsStore] refreshLocalMaps')
    localMapsError.set(e.message ?? String(e))
    localMaps.set([])
  } finally {
    localMapsLoading.set(false)
    isLoadingLocal = false
  }
}

/** Public refresh (manual) */
export async function refreshLocalMaps() {
  const dir = get(mapsDirectory).trim()
  if (!dir) return
  markManualUpdate()
  await _loadLocal(dir, 'manual')
}

// initial load + watch mapsDirectory changes
if (browser && !hasInitialized) {
  hasInitialized = true
  console.log('[mapsStore] Top-level browser init triggered')

  const init = get(mapsDirectory).trim()
  if (init) {
    markManualUpdate()
    _loadLocal(init, 'init').catch(console.error)
  }

  mapsDirectory.subscribe((d) => {
    const dir = d.trim()
    if (!dir || dir === lastDir || isLoadingLocal) return
    lastDir = dir
    markManualUpdate()
    _loadLocal(dir, 'mapsDirectory.subscribe').catch(console.error)
  })

  // other explicit triggers
  listen('maps-changed', () => {
    const dir = get(mapsDirectory)
    if (dir) {
      markManualUpdate()
      _loadLocal(dir, 'maps-changed').catch(console.error)
    }
  }).catch(console.error)

  // watcher events
  listen<{ path: string; kind: string }>('rust-fs-change', (evt) => {
    const dir = get(mapsDirectory)
    if (!dir || !evt.payload.path.startsWith(normalizePath(dir))) return

    if (manualUpdateInProgress) {
      manualUpdateInProgress = false
      return
    }
    _loadLocal(dir, 'rust-fs-change').catch(console.error)
  }).catch(console.error)
}

// mod.io maps
export const modioMaps = writable<Mod[]>([])
export const modioMapsLoading = writable(false)
export const modioMapsError = writable<string | null>(null)

export async function refreshModioMaps() {
  if (get(modioMapsLoading)) return
  modioMapsLoading.set(true)
  modioMapsError.set(null)
  try {
    const mods = await fetchAllModioItems('maps')
    modioMaps.set(mods)
    if (browser) {
      modioMapsSearchIndex.clear()
      modioMapsSearchIndex.add(mods)
    }
  } catch (e: any) {
    handleError(e, '[mapsStore] refreshModioMaps')
    modioMapsError.set(e.message ?? String(e))
    modioMaps.set([])
  } finally {
    modioMapsLoading.set(false)
  }
}
