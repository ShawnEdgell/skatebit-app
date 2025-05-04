// src/lib/services/modioCacheService.ts
import type { Mod } from '$lib/types/modioTypes'

const BASE_URLS = {
  maps: 'https://modio-cache.vercel.app/maps_v2',
  mods: 'https://modio-cache.vercel.app/mods_v2',
}

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

async function fetchModioPage(
  type: 'maps' | 'mods',
  page: number,
): Promise<Mod[]> {
  const url = `${BASE_URLS[type]}/page_${page}.json`
  try {
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()
    const list = Array.isArray(data?.[type]) ? (data[type] as Mod[]) : []
    return list.filter(filterByPlatform)
  } catch {
    return []
  }
}

export async function fetchAllModioItems(
  type: 'maps' | 'mods',
  maxPages = type === 'maps' ? 50 : 20,
): Promise<Mod[]> {
  let all: Mod[] = []
  let page = 1
  let more = true

  while (more && page <= maxPages) {
    const batch = await fetchModioPage(type, page)
    if (batch.length === 0) {
      more = false
    } else {
      all = all.concat(batch)
      if (batch.length < 100) more = false
      else page++
    }
  }

  return all
}

export function modToFsEntry(mod: Mod) {
  const fallbackImage =
    mod.logo?.thumb_320x180 || mod.media?.images?.[0]?.thumb_320x180 || null

  return {
    name: mod.name,
    path: `/modio/${mod.id}`,
    isDirectory: false,
    size: mod.modfile?.filesize ?? null,
    modified: mod.date_updated,
    thumbnailPath: fallbackImage,
    thumbnailMimeType: null,
  }
}

export function sortMods(
  mods: Mod[],
  type: 'recent' | 'popular' | 'downloads',
) {
  const sortMap = {
    recent: (a: Mod, b: Mod) => (b.date_updated ?? 0) - (a.date_updated ?? 0),
    popular: (a: Mod, b: Mod) =>
      (a.stats?.popularity_rank_position ?? Infinity) -
      (b.stats?.popularity_rank_position ?? Infinity),
    downloads: (a: Mod, b: Mod) =>
      (b.stats?.downloads_total ?? 0) - (a.stats?.downloads_total ?? 0),
  }
  return mods.slice().sort(sortMap[type])
}
