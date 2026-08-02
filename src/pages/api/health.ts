import type { APIRoute } from 'astro';

export const prerender = false;

// Liveness/readiness probe for load balancers and container orchestrators.
// Deliberately reveals nothing about internals.
export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({ status: 'ok' }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
};
