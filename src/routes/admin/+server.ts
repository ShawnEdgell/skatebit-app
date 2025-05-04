import type { RequestHandler } from '@sveltejs/kit'

// Tell SvelteKit not to prerender this endpoint
export const prerender = false

import { cacheAllMapModsToFirestore } from '$lib/api/mapsCache'

export const GET: RequestHandler = async () => {
  try {
    await cacheAllMapModsToFirestore()
    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error: any) {
    console.error('Cache update failed:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500 },
    )
  }
}
