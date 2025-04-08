// src/lib/api/modio.ts
import { MODIO_DOMAIN, MODIO_API_KEY } from "$env/static/private";
import { API_PAGE_SIZE } from "./constants";

/**
 * Fetches mods from mod.io for a given game.
 *
 * @param apiKey API key (defaults to environment key)
 * @param gameId ID of the game
 * @param limit Maximum number of mods to fetch (defaults to API_PAGE_SIZE)
 * @param offset Offset for pagination
 * @param sort Sort order string (defaults to "-date_added")
 * @returns An array of mod objects.
 */
export async function fetchMapMods(
  apiKey: string = MODIO_API_KEY,
  gameId: string,
  limit: number = API_PAGE_SIZE,
  offset: number = 0,
  sort: string = "-date_added"
) {
  const url = `https://${MODIO_DOMAIN}/v1/games/${gameId}/mods?api_key=${apiKey}&tags-in=Map&_sort=${sort}&_limit=${limit}&_offset=${offset}`;
  const res = await fetch(url);
  if (!res.ok) {
    const errorText = await res.text();
    console.error("mod.io API error:", res.status, errorText);
    throw new Error(`Failed to fetch mod data: ${res.status}`);
  }
  const data = await res.json();
  return data.data;
}
