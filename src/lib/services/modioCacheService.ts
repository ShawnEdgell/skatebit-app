import type { Mod } from '$lib/types/modioTypes';

// This now points to your local SvelteKit API route (proxy)
const PROXY_API_URL = '/api/maps';

const EXCLUDED_PLATFORMS = new Set(['PS4', 'PS5', 'XBOX', 'PLAYSTATION', 'NINTENDO']);

function filterByPlatform(mod: Mod): boolean {
  if (!Array.isArray(mod.tags)) return true;
  return !mod.tags.some((tag) => {
    const raw = tag.name ?? '';
    const up = raw.toUpperCase();
    if (!up.startsWith('CONSOLE_SELECTED_')) return false;
    const parts = up.split('_');
    const suffix = parts[parts.length - 1];
    return EXCLUDED_PLATFORMS.has(suffix);
  });
}

export async function fetchAllMaps(): Promise<Mod[]> {
  try {
    const response = await fetch(PROXY_API_URL);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    const data = await response.json() as { items: Mod[] };
    const list = Array.isArray(data.items) ? data.items : [];
    return list.filter(filterByPlatform);
  } catch (error) {
    console.error(`Error fetching maps from proxy API:`, error);
    throw error;
  }
}

export function mapToFsEntry(mod: Mod) {
  const fallbackImage =
    mod.logo?.thumb_320x180 || mod.media?.images?.[0]?.thumb_320x180 || null;

  return {
    name: mod.name,
    path: `/modio/${mod.id}`,
    isDirectory: false,
    size: mod.modfile?.filesize ?? null,
    modified: mod.date_updated,
    thumbnailPath: fallbackImage,
    thumbnailMimeType: null,
  };
}

export function sortMaps(
  maps: Mod[],
  type: 'recent' | 'popular' | 'downloads',
) {
  const sortMap = {
    recent: (a: Mod, b: Mod) => (b.date_updated ?? 0) - (a.date_updated ?? 0),
    popular: (a: Mod, b: Mod) =>
      (a.stats?.popularity_rank_position ?? Infinity) -
      (b.stats?.popularity_rank_position ?? Infinity),
    downloads: (a: Mod, b: Mod) =>
      (b.stats?.downloads_total ?? 0) - (a.stats?.downloads_total ?? 0),
  };

  return [...maps].sort(sortMap[type]);
}
