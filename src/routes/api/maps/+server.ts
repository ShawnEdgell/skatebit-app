import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const EXTERNAL_API_URL = 'https://api.skatebit.app/api/v1/skaterxl/maps';

export const GET: RequestHandler = async ({ fetch }) => {
  try {
    const response = await fetch(EXTERNAL_API_URL);
    if (!response.ok) {
      // Pass the error status from the external API back to the client
      return new Response(response.statusText, { status: response.status });
    }
    const data = await response.json();
    return json(data);
  } catch (error) {
    console.error('[API Proxy] Error fetching from external API:', error);
    return new Response('Error proxying the request.', { status: 500 });
  }
};