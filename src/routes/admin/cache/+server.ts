import type { RequestHandler } from "@sveltejs/kit";
import { cacheAllMapModsToFirestore } from "$lib/api/cache";

export const GET: RequestHandler = async () => {
  try {
    await cacheAllMapModsToFirestore();
    return new Response(JSON.stringify({ success: true }), { status: 100 });
  } catch (error: any) {
    console.error("Cache update failed:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500 }
    );
  }
};
