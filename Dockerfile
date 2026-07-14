# syntax=docker/dockerfile:1.7
#
# The `syntax` line above is load-bearing, not decoration: it pins a BuildKit
# frontend new enough to understand the `RUN --mount=type=cache` lines below.
# Without it, an older frontend rejects them and the build fails outright.

# ---- Base -----------------------------------------------------------------
FROM node:20-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# openssl is required by Prisma's query engine
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

# ---- Dependencies ---------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json* ./
# prisma schema is needed for the `postinstall: prisma generate` step
COPY prisma ./prisma

# `npm ci`, not `npm install`. It skips dependency resolution entirely and lays
# down exactly what package-lock.json pins - faster, and it cannot silently
# drift from the lockfile the way `install` can.
#
# The cache mount is where the real time goes. /root/.npm is npm's package cache,
# and on a mount it PERSISTS ACROSS BUILDS while staying out of the image layer.
# Change one dependency without it and npm re-downloads all ~700MB of tarballs
# from the registry; with it, the untouched 99% are already local and npm just
# re-links them.
#
# sharing=locked so two concurrent builds queue on the cache instead of
# corrupting it.
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --no-audit --no-fund

# ---- Build ----------------------------------------------------------------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Same trick, and it matters even more here. .next/cache is where Next keeps its
# webpack/SWC compilation cache. Discard it between builds - which is what an
# unmounted build does - and every single build is a COLD compile of three.js,
# tailwind and every route, whether you changed one line or a thousand.
# Persisted, an edit recompiles only what it touched.
#
# Because it is a mount and not a layer, .next/cache is empty in the image that
# comes out - which is exactly right. The compile cache is build scratch and has
# no business shipping to production; Next recreates the directory at runtime if
# it wants one.
RUN --mount=type=cache,target=/app/.next/cache,sharing=locked \
    npm run build

# ---- Runner ---------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# node_modules is copied whole, dev dependencies included, and that is deliberate.
# The entrypoint shells out to `npx prisma` on every boot, and README's
# "Applying a destructive schema change" tells you to run
# `docker compose run --rm --entrypoint npx web prisma db push --accept-data-loss`.
# `prisma` is a devDependency, so pruning dev deps here would break both - the CLI
# would be missing and npx would try to fetch it from the network at boot.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.mjs ./next.config.mjs
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
