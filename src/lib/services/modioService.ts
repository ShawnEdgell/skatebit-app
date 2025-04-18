// src/lib/services/modioService.ts

import { db } from '$lib/firebase/firebase'
import { doc, getDoc } from 'firebase/firestore'
import type { Mod } from '$lib/types/modioTypes'
import { handleError } from '$lib/utils/errorHandler'
import { FIRESTORE_PAGE_SIZE_ESTIMATE } from '$lib/api/modioConstants'

// Any suffix here will be excluded when it appears after "Console_Selected_"
const EXCLUDED_PLATFORMS = new Set([
  'PS4',
  'PS5',
  'XBOX',
  'PLAYSTATION',
  'NINTENDO',
])

/**
 * Returns false (i.e. filters out) if any of the mod's tags is
 * "Console_Selected_<PLATFORM>" where PLATFORM is in EXCLUDED_PLATFORMS.
 * Keeps Console_Selected_PC (or anything else).
 */
function filterByPlatform(mod: Mod): boolean {
  if (!Array.isArray(mod.tags)) return true
  return !mod.tags.some((tag) => {
    // pick the localized name if it exists, otherwise the raw name
    const raw = tag.name ?? ''
    const up = raw.toUpperCase() // normalize
    if (!up.startsWith('CONSOLE_SELECTED_')) return false
    const parts = up.split('_')
    const suffix = parts[parts.length - 1] // PS4, PC, XBOX, etc.
    return EXCLUDED_PLATFORMS.has(suffix)
  })
}

export const fetchModsPage = async (page: number): Promise<Mod[]> => {
  try {
    const snap = await getDoc(doc(db, 'mods', `page_${page}`))
    if (!snap.exists()) return []
    const data = snap.data()
    const mods = Array.isArray(data?.mods) ? (data.mods as Mod[]) : []
    return mods.filter(filterByPlatform)
  } catch (e) {
    handleError(e, `fetchModsPage (page ${page})`)
    return []
  }
}

export const fetchAllMods = async (): Promise<Mod[]> => {
  let all: Mod[] = []
  let page = 1
  let more = true

  while (more && page <= 50) {
    console.log(`Fetching mods page ${page}…`)
    const batch = await fetchModsPage(page)
    console.log(`→ got ${batch.length}`)
    all = all.concat(batch)

    if (
      batch.length === 0 ||
      batch.length < FIRESTORE_PAGE_SIZE_ESTIMATE * 0.8
    ) {
      more = false
    } else {
      page++
    }
  }

  console.log(`Finished fetching. Total mods: ${all.length}`)
  return all
}

const sortMap = {
  recent: (a: Mod, b: Mod) => (b.date_updated ?? 0) - (a.date_updated ?? 0),
  popular: (a: Mod, b: Mod) =>
    (a.stats?.popularity_rank_position ?? Infinity) -
    (b.stats?.popularity_rank_position ?? Infinity),
  downloads: (a: Mod, b: Mod) =>
    (b.stats?.downloads_total ?? 0) - (a.stats?.downloads_total ?? 0),
}

export type SortType = keyof typeof sortMap

export const sortMods = (mods: Mod[], sortType: SortType): Mod[] =>
  mods.slice().sort(sortMap[sortType])

export function mapModToFsEntry(mod: Mod) {
  return {
    name: mod.name,
    path: `/modio/${mod.id}`,
    isDirectory: false,
    size: mod.modfile?.filesize ?? null,
    modified: mod.date_updated,
    thumbnailPath: mod.logo?.thumb_320x180 ?? null,
    thumbnailMimeType: null,
  }
}

export async function fetchAllModsAsFsEntries() {
  const mods = await fetchAllMods()
  return mods.map(mapModToFsEntry)
}
