import type { Mod } from '$lib/types/modioTypes';
import type { PageServerLoad } from './$types';

// This now points to your own local proxy
const PROXY_API_URL = '/api/maps';

export const load: PageServerLoad = async ({ fetch }) => {
  try {
    const response = await fetch(PROXY_API_URL);
    if (!response.ok) {
      throw new Error(`Proxy API request failed with status: ${response.status}`);
    }
    const data = await response.json();
    const mapMods: Mod[] = data.items || [];
    return { mapMods };
  } catch (error) {
    console.error('Error fetching maps in page.server.ts:', error);
    return { mapMods: [] };
  }
};