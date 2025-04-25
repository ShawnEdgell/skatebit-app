// src/lib/api/modioFetch.ts

import { API_PAGE_SIZE } from './modioConstants' // Ensure path is correct

/**
 * Fetches map mods from the mod.io API.
 * Uses global fetch (available in Node 18+, Bun).
 *
 * @param apiKey - Your mod.io API Key.
 * @param modioDomain - The mod.io API domain (e.g., 'api.mod.io').
 * @param gameId - The ID of the game on mod.io.
 * @param limit - The number of results per page.
 * @param offset - The starting offset for pagination.
 * @param sort - The sorting parameter (default: '-date_updated').
 * @returns A promise that resolves to an array of mod objects.
 */
export async function fetchMapMods(
  apiKey: string,
  modioDomain: string,
  gameId: string,
  limit: number = API_PAGE_SIZE,
  offset: number = 0,
  sort: string = '-date_updated', // Sort by last updated, descending
) {
  const url = `https://${modioDomain}/v1/games/${gameId}/mods?api_key=${apiKey}&tags-in=Map&_sort=${sort}&_limit=${limit}&_offset=${offset}`
  console.log(`Workspaceing mods from: ${url.replace(apiKey, '***')}`) // Mask API key

  try {
    const res = await fetch(url)
    if (!res.ok) {
      const errorText = await res.text()
      console.error(
        `mod.io API error (${res.status}): ${errorText} for URL: ${url.replace(apiKey, '***')}`,
      )
      throw new Error(
        `Failed to fetch mod data from mod.io: Status ${res.status}`,
      )
    }
    const data = await res.json()
    if (!data || !Array.isArray(data.data)) {
      console.warn(
        `mod.io response structure unexpected. Expected 'data' array. Response:`,
        data,
      )
      return []
    }
    return data.data
  } catch (error) {
    console.error(`Network or fetch error calling mod.io API: ${error}`)
    throw error // Re-throw
  }
}
