import { db } from '$lib/firebase/firebase'
import { doc, getDoc } from 'firebase/firestore'
import type { Mod } from '$lib/types/modioTypes'
import { handleError } from '$lib/utils/errorHandler'

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
  const docId = `page_${page}`
  const docPath = `mods_v2/${docId}`
  try {
    console.log(`[fetchModsPage] Attempting to get doc: ${docPath}`)
    const docRef = doc(db, 'mods_v2', docId)
    const snap = await getDoc(docRef)
    if (!snap.exists()) {
      console.log(`[fetchModsPage] Document not found: ${docPath}`)
      return []
    }
    const data = snap.data()
    const mods = Array.isArray(data?.mods) ? (data.mods as Mod[]) : []
    return mods.filter(filterByPlatform)
  } catch (e) {
    handleError(e, `fetchModsPage (page ${page}) - Path: ${docPath}`)
    return []
  }
}

export const fetchAllMods = async (): Promise<Mod[]> => {
  let all: Mod[] = []
  let page = 1
  let more = true

  while (more && page <= 50) {
    console.log(`Fetching mods page ${page}…`)
    try {
      const batch = await fetchModsPage(page)
      console.log(`→ got ${batch.length}`)
      if (batch.length === 0) {
        more = false
      } else {
        all = all.concat(batch)
        if (batch.length < 250) {
          more = false
        } else {
          page++
        }
      }
    } catch (error) {
      console.error(
        `Error fetching page ${page} in fetchAllModsFromFirebase, stopping.`,
      )
      more = false
    }
  }

  console.log(`Finished fetching all mods: ${all.length}`)
  return all
}

export function mapModToFsEntry(mod: Mod) {
  const fallbackImage =
    mod.logo?.thumb_320x180 || mod.media?.images?.[0]?.thumb_320x180 || null

  return {
    name: mod.name,
    path: `/modio/${mod.id}`,
    isDirectory: false,
    size: mod.modfile?.filesize ?? null,
    modified: mod.date_updated,
    thumbnailPath: fallbackImage, // ← this is KEY!
    thumbnailMimeType: null,
  }
}

export async function fetchAllModsAsFsEntries() {
  const mods = await fetchAllMods()
  return mods.map(mapModToFsEntry)
}
