// src/lib/api/modioFetch.ts

import { API_PAGE_SIZE } from './modioConstants'

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
  // Construct the API URL
  const url = `https://${modioDomain}/v1/games/${gameId}/mods?api_key=${apiKey}&tags-in=Map&_sort=${sort}&_limit=${limit}&_offset=${offset}`

  // Log the fetch attempt (mask API key)
  console.log(`Workspaceing mods from: ${url.replace(apiKey, '***')}`)

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

    // Basic validation of the response structure
    if (!data || !Array.isArray(data.data)) {
      console.warn(
        `mod.io response structure unexpected. Expected 'data' array. Response:`,
        data,
      )
      return [] // Return empty array if structure is not as expected
    }

    return data.data // Return the array of mods
  } catch (error) {
    console.error(`Network or fetch error calling mod.io API: ${error}`)
    // Re-throw the error to be caught by the calling function
    throw error
  }
}
