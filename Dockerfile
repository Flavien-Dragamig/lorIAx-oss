# syntax=docker/dockerfile:1.7
# ============================================================
# LorIAx — Dockerfile Production (multi-stage optimisé)
#
# Cache mounts BuildKit activés (~/.npm et .next/cache) pour
# accélérer les builds incrémentaux. Premier build : ~5 min.
# Builds suivants (code seul modifié) : ~1-2 min.
# Nécessite DOCKER_BUILDKIT=1 (par défaut sur Docker >= 23).
# ============================================================

FROM node:22-alpine AS base

RUN apk add --no-cache libc6-compat curl
WORKDIR /app

# --- Étape 1 : Dépendances complètes (build) ---
# Timeouts longs + retries : protège contre les binaires natifs lourds
# (livekit, @next/swc, ollama) qui dépassent le timeout npm par défaut (60s).
FROM base AS deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --legacy-peer-deps \
      --fetch-timeout=600000 \
      --fetch-retries=5 \
      --fetch-retry-mintimeout=20000 \
      --fetch-retry-maxtimeout=120000

# --- Étape 1b : Dépendances production seules (runtime) ---
FROM base AS deps-prod
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --legacy-peer-deps \
      --fetch-timeout=600000 \
      --fetch-retries=5 \
      --fetch-retry-mintimeout=20000 \
      --fetch-retry-maxtimeout=120000

# --- Étape 2 : Build Next.js + custom server ---
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Variables NEXT_PUBLIC_* : inlinées par Next.js dans les bundles client au
# moment du build. Doivent donc être fournies en build-args (le `.env` runtime
# de Dokploy arrive trop tard). Voir scripts/build-and-push.sh.
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_ROOT_DOMAIN
ARG NEXT_PUBLIC_LICENSE_MANAGER_URL
ARG NEXT_PUBLIC_ENTERPRISE_CONTACT_URL
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    NEXT_PUBLIC_ROOT_DOMAIN=${NEXT_PUBLIC_ROOT_DOMAIN} \
    NEXT_PUBLIC_LICENSE_MANAGER_URL=${NEXT_PUBLIC_LICENSE_MANAGER_URL} \
    NEXT_PUBLIC_ENTERPRISE_CONTACT_URL=${NEXT_PUBLIC_ENTERPRISE_CONTACT_URL}

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build Next.js (standalone output)
# Cache .next/cache : Turbopack/SWC réutilisent la compilation entre builds
# lorsque le code source n'a pas changé.
RUN --mount=type=cache,target=/app/.next/cache \
    npm run build

# Bundle custom server (Hocuspocus WebSocket) avec esbuild
# --packages=external : les packages npm restent en require() externe (non bundlés)
# --bundle résout et inline les imports locaux (@/* alias inclus)
RUN node_modules/.bin/esbuild server.ts \
    --bundle \
    --platform=node \
    --target=node22 \
    --packages=external \
    --outfile=.next/standalone/server.js \
    --tsconfig=tsconfig.json

# --- Étape 3 : Image de production minimale ---
FROM node:22-alpine AS runner
WORKDIR /app

ARG APP_VERSION=dev
ENV APP_VERSION=${APP_VERSION}

RUN apk add --no-cache curl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Utilisateur non-root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copier les fichiers de build
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/db/migrations ./migrations

# Dépendances de production pour server.ts (non tracées par le standalone Next.js)
COPY --from=deps-prod --chown=nextjs:nodejs /app/node_modules ./node_modules

# Dossier workspaces (volumes git pour les documents)
RUN mkdir -p /app/workspaces && chown nextjs:nodejs /app/workspaces

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Healthcheck intégré (vérifie /api/health toutes les 30s)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

LABEL org.opencontainers.image.title="LorIAx" \
      org.opencontainers.image.description="Plateforme collaborative de gestion de connaissances" \
      org.opencontainers.image.source="https://github.com/your-org/loriax" \
      org.opencontainers.image.version="${APP_VERSION}"

CMD ["node", "server.js"]
