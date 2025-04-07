import { MODIO_DOMAIN, MODIO_API_KEY } from "$env/static/private";
import { API_PAGE_SIZE } from "./constants";

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
