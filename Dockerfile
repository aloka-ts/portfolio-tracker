# --- deps: shared dependency layer -------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# --- dev: hot-reload dev server (used by docker-compose via `target: dev`)
FROM deps AS dev
COPY . .
EXPOSE 3001
ENV HOST=0.0.0.0 PORT=3001 ASTRO_TELEMETRY_DISABLED=1
CMD ["npm", "run", "dev"]

# --- build: production bundle -------------------------------------------
FROM deps AS build
COPY . .
ENV ASTRO_TELEMETRY_DISABLED=1
RUN npm run build && npm prune --omit=dev

# --- runtime: hardened production image (default target) ----------------
FROM node:22-alpine
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=build --chown=app:app /app/dist ./dist
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/package.json ./
USER app
ENV HOST=0.0.0.0 PORT=8080 NODE_ENV=production ASTRO_TELEMETRY_DISABLED=1
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/api/health || exit 1
CMD ["node", "./dist/server/entry.mjs"]
