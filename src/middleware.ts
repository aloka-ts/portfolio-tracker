import { defineMiddleware } from 'astro:middleware';

// Security headers on every response. CSP is omitted for now: Layout.astro
// relies on inline scripts (theme anti-flash, particles), so a strict CSP
// needs nonces first — add later rather than shipping 'unsafe-inline' theater.
export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();
  const headers = response.headers;
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // Ignored on plain HTTP (dev); effective once served over TLS. No preload yet.
  headers.set('Strict-Transport-Security', 'max-age=31536000');
  return response;
});
