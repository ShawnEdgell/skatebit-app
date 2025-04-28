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

export const fetchModsPage = async (page: number): Promise<Mod[]> => {
  const docId = `page_${page}` // Define the document ID
  const docPath = `mods/${docId}` // Define the full path for logging
  try {
    console.log(`[fetchModsPage] Attempting to get doc: ${docPath}`) // Log the correct path
    const docRef = doc(db, 'mods', docId) // Use the docId variable
    const snap = await getDoc(docRef)
    if (!snap.exists()) {
      console.log(`[fetchModsPage] Document not found: ${docPath}`)
      return []
    }
    const data = snap.data()
    const mods = Array.isArray(data?.mods) ? (data.mods as Mod[]) : []
    return mods.filter(filterByPlatform)
  } catch (e) {
    // Pass the error and context to the handler
    handleError(e, `fetchModsPage (page ${page}) - Path: ${docPath}`)
    return [] // Return empty array on error
  }
}

export const fetchAllMods = async (): Promise<Mod[]> => {
  let all: Mod[] = []
  let page = 1
  let more = true

  while (more && page <= 50) {
    // Limit to 50 pages to prevent infinite loops
    console.log(`Fetching mods page ${page}…`)
    try {
      // Add try-catch around fetchModsPage call
      const batch = await fetchModsPage(page)
      console.log(`→ got ${batch.length}`)
      if (batch.length === 0) {
        more = false // Stop if a page returns 0 mods
      } else {
        all = all.concat(batch)
        // Adjust stopping condition if needed
        if (batch.length < FIRESTORE_PAGE_SIZE_ESTIMATE * 0.5) {
          // Stop if significantly less than expected
          more = false
        } else {
          page++
        }
      }
    } catch (error) {
      // Error is already handled within fetchModsPage, but we can log here too
      console.error(`Error fetching page ${page} in fetchAllMods, stopping.`)
      more = false // Stop fetching on error
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
    path: `/modio/${mod.id}`, // Example path structure
    isDirectory: false,
    size: mod.modfile?.filesize ?? null,
    modified: mod.date_updated, // Assuming this is a Unix timestamp
    thumbnailPath: mod.logo?.thumb_320x180 ?? null,
    thumbnailMimeType: null, // Usually not available directly
  }
}

export async function fetchAllModsAsFsEntries() {
  const mods = await fetchAllMods()
  return mods.map(mapModToFsEntry)
}
