import { writable, get } from 'svelte/store'
import { browser } from '$app/environment'
import { listen } from '@tauri-apps/api/event'
import { modsDirectory } from './globalPathsStore'
import { loadLocalMods } from '$lib/services/fileService'
import { normalizePath } from '$lib/services/pathService'
import { handleError } from '$lib/utils/errorHandler'
import { modsSearchIndex } from '$lib/utils/flexSearchUtils'
import { fetchAllMods } from '$lib/services/modsService'
import { createSearchStore } from './searchStore'
import type { FsEntry, DirectoryListingResult } from '$lib/types/fsTypes'
import type { Mod } from '$lib/types/modioTypes'
import { derived } from 'svelte/store'

// ─── Local Mods ─────────────────────────────────────────────

export const localMods = writable<FsEntry[]>([])
export const localModsLoading = writable(false)
export const localModsError = writable<string | null>(null)

const trustedAuthorUsernames = new Set<string>([
  'froquede',
  'xlGURU',
  'jbooogie',
  'mcbtay',
  'KleptoXL',
  'Silentbaws',
  'andreamatt',
  'MateusSXL',
  'SqueegeeDinoToy',
  'billowper',
  'STPN',
  'SqueegeeDinoToy',
  'billowper',
])

let manualUpdateInProgress = false
function markManualUpdate() {
  manualUpdateInProgress = true
}

async function _loadLocalMods(dir: string) {
  localModsLoading.set(true)
  localModsError.set(null)
  try {
    const res = (await loadLocalMods(
      normalizePath(dir),
    )) as DirectoryListingResult
    localMods.set(res.entries)
  } catch (e: any) {
    handleError(e, '[modsStore] refreshLocalMods')
    localModsError.set(e.message ?? String(e))
    localMods.set([])
  } finally {
    localModsLoading.set(false)
  }
}

export async function refreshLocalMods() {
  const dir = get(modsDirectory).trim()
  console.log('[modsStore] manual refreshLocalMods called for:', dir)
  if (!dir) return
  markManualUpdate()
  await _loadLocalMods(dir)
}

if (browser) {
  const init = get(modsDirectory).trim()
  if (init) {
    markManualUpdate()
    _loadLocalMods(init).catch(console.error)
  }

  modsDirectory.subscribe((d) => {
    const dir = d.trim()
    console.log('[modsStore] modsDirectory subscribed change:', dir)
    if (dir) {
      markManualUpdate()
      _loadLocalMods(dir).catch(console.error)
    }
  })

  listen('mods-changed', () => {
    const dir = get(modsDirectory)
    if (dir) {
      markManualUpdate()
      _loadLocalMods(dir).catch(console.error)
    }
  }).catch(console.error)

  listen<{ path: string; kind: string }>('rust-fs-change', (evt) => {
    const dir = get(modsDirectory)
    if (!dir || !evt.payload.path.startsWith(normalizePath(dir))) return

    if (manualUpdateInProgress) {
      manualUpdateInProgress = false
      return
    }
    _loadLocalMods(dir).catch(console.error)
  }).catch(console.error)
}

// ─── Remote Mods (Firebase Cached) ──────────────────────────

export const modioMods = writable<Mod[]>([])
export const modioModsLoading = writable(false)
export const modioModsError = writable<string | null>(null)

export async function refreshModioMods() {
  if (get(modioModsLoading)) return
  modioModsLoading.set(true)
  modioModsError.set(null)
  try {
    const mods = await fetchAllMods()
    modioMods.set(mods)
    if (browser) {
      modsSearchIndex.clear()
      modsSearchIndex.add(mods)
    }
  } catch (e: any) {
    handleError(e, '[modsStore] refreshModioMods')
    modioModsError.set(e.message ?? String(e))
    modioMods.set([])
  } finally {
    modioModsLoading.set(false)
  }
}

export const trustedMods = derived(modioMods, ($mods) =>
  $mods.filter((mod) =>
    trustedAuthorUsernames.has(mod.submitted_by?.username ?? ''),
  ),
)

// ─── Mod Search Store ───────────────────────────────────────

export const modsSortOrder = writable<'recent' | 'popular' | 'downloads'>(
  'recent',
)

const modSearch = createSearchStore<
  Mod,
  'recent' | 'popular' | 'downloads',
  { id: number }
>(trustedMods, modsSearchIndex, {
  sortStore: modsSortOrder,
  sortFn: (a, b, order) => {
    switch (order) {
      case 'popular':
        return (
          (a.stats?.popularity_rank_position ?? Infinity) -
          (b.stats?.popularity_rank_position ?? Infinity)
        )
      case 'downloads':
        return (b.stats?.downloads_total ?? 0) - (a.stats?.downloads_total ?? 0)
      case 'recent':
      default:
        return (b.date_updated ?? 0) - (a.date_updated ?? 0)
    }
  },
  idField: 'id',
  hitToId: (hit) => String(hit.id),
})

export const modsSearchQuery = modSearch.query
export const modsResults = modSearch.results
export const modsLoading = modioModsLoading // alias for UI consistency
export const refreshMods = refreshModioMods // alias for UI consistency
