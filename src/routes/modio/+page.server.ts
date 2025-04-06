import type { ModsData } from "$lib/types/modio";
import { fetchModsByCategory } from "$lib/api/modio";
import { MODIO_API_KEY } from "$env/static/private";

export const load = async (): Promise<{ modsData: ModsData }> => {
  try {
    const gameId = "629"; // Skater XL game ID
    // Fetch mod data concurrently for each category.
    const [gearMods, mapMods, scriptMods] = await Promise.all([
      fetchModsByCategory(MODIO_API_KEY, gameId, "Gear", 10),
      fetchModsByCategory(MODIO_API_KEY, gameId, "Map", 10),
      fetchModsByCategory(MODIO_API_KEY, gameId, "Script", 10),
    ]);
    return { modsData: { gearMods, mapMods, scriptMods } };
  } catch (error) {
    console.error("Error fetching mod data:", error);
    return { modsData: { gearMods: [], mapMods: [], scriptMods: [] } };
  }
};
