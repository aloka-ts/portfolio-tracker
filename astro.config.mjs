// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  // Server output: API routes (/api/prices, /api/history) are SSR.
  // The standalone server reads HOST/PORT env at runtime (container sets 8080).
  output: 'server',
  adapter: node({ mode: 'standalone' }),

  server: {
    port: 3001,
    host: true
  },

  vite: {
    plugins: [tailwindcss()],
    server: {
      allowedHosts: true
    }
  },

  integrations: [react()]
});
