import { db } from '$lib/firebase/firebase'
import { doc, getDoc } from 'firebase/firestore'
import type { Mod } from '$lib/types/modioTypes'
import { handleError } from '$lib/utils/errorHandler'
import { FIRESTORE_PAGE_SIZE_ESTIMATE } from '$lib/api/modioConstants'

const EXCLUDED_PLATFORMS = new Set([
  'PS4',
  'PS5',
  'XBOX',
  'PLAYSTATION',
  'NINTENDO',
])

function filterByPlatform(mod: Mod): boolean {
  if (!Array.isArray(mod.tags)) return true
  return !mod.tags.some((tag) => {
    const raw = tag.name ?? ''
    const up = raw.toUpperCase()
    if (!up.startsWith('CONSOLE_SELECTED_')) return false
    const parts = up.split('_')
    const suffix = parts[parts.length - 1]
    return EXCLUDED_PLATFORMS.has(suffix)
  })
}

export const fetchMapsPage = async (page: number): Promise<Mod[]> => {
  const docId = `page_${page}`
  const docPath = `maps_v2/${docId}`
  try {
    console.log(`[fetchMapsPage] Attempting to get doc: ${docPath}`)
    const docRef = doc(db, 'maps_v2', docId)
    const snap = await getDoc(docRef)
    if (!snap.exists()) {
      console.log(`[fetchMapsPage] Document not found: ${docPath}`)
      return []
    }
    const data = snap.data()
    const maps = Array.isArray(data?.maps) ? (data.maps as Mod[]) : []
    return maps.filter(filterByPlatform)
  } catch (e) {
    handleError(e, `fetchMapsPage (page ${page}) - Path: ${docPath}`)
    return []
  }
}

export const fetchAllMaps = async (): Promise<Mod[]> => {
  let all: Mod[] = []
  let page = 1
  let more = true

  while (more && page <= 50) {
    console.log(`Fetching maps page ${page}…`)
    try {
      const batch = await fetchMapsPage(page)
      console.log(`→ got ${batch.length}`)
      if (batch.length === 0) {
        more = false
      } else {
        all = all.concat(batch)
        if (batch.length < FIRESTORE_PAGE_SIZE_ESTIMATE * 0.5) {
          more = false
        } else {
          page++
        }
      }
    } catch (error) {
      console.error(`Error fetching page ${page} in fetchAllMaps, stopping.`)
      more = false
    }
  }

  console.log(`✅ Finished fetching. Total maps: ${all.length}`)
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

export const sortMaps = (maps: Mod[], sortType: SortType): Mod[] =>
  maps.slice().sort(sortMap[sortType])

export function mapToFsEntry(mod: Mod) {
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

export async function fetchAllMapsAsFsEntries() {
  const maps = await fetchAllMaps()
  return maps.map(mapToFsEntry)
}
