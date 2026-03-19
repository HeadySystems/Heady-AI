<<<<<<< HEAD
# HEADY_BRAND:BEGIN
# ╔══════════════════════════════════════════════════════════════════╗
# ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
# ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
# ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
# ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
# ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
# ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
# ║                                                                  ║
# ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
# ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
# ║  FILE: Dockerfile                                                    ║
# ║  LAYER: root                                                  ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END
FROM node:20-alpine
=======
# ═══════════════════════════════════════════════════════════════════════════════
# Heady™ Production Dockerfile — Multi-Stage Build
# ═══════════════════════════════════════════════════════════════════════════════
#
# Three stages: deps → build → production
# Node 22 Alpine, tini for proper PID 1, non-root heady user,
# production tuning, pruned node_modules, health check baked in.
#
# © HeadySystems Inc.

# ─── Stage 1: Dependencies ────────────────────────────────────────────────────

FROM node:25-alpine AS deps
>>>>>>> hc-testing/dependabot/docker/node-25-slim

WORKDIR /app

COPY package*.json ./
COPY scripts/ ./scripts/
RUN npm install --omit=dev

<<<<<<< HEAD
=======
# Copy package files
COPY package.json pnpm-lock.yaml* package-lock.json* yarn.lock* ./

# Install with preferred package manager
RUN if [ -f pnpm-lock.yaml ]; then \
      corepack enable && pnpm install --frozen-lockfile --prod; \
    elif [ -f yarn.lock ]; then \
      yarn install --production --frozen-lockfile; \
    else \
      npm ci --omit=dev; \
    fi

# ─── Stage 2: Build ──────────────────────────────────────────────────────────

FROM node:25-alpine AS build

WORKDIR /app

# Copy deps from stage 1
COPY --from=deps /app/node_modules ./node_modules

# Copy source
>>>>>>> hc-testing/dependabot/docker/node-25-slim
COPY . .

RUN npm run build || true

EXPOSE 3300

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -qO- http://localhost:3300/api/health || exit 1

<<<<<<< HEAD
=======
FROM node:25-alpine AS production

# Install tini for proper PID 1 signal handling (SIGTERM → graceful shutdown)
RUN apk add --no-cache tini curl

# Create non-root heady user
RUN addgroup -g 1001 -S heady && \
    adduser -S heady -u 1001 -G heady

WORKDIR /app

# Copy production artifacts
COPY --from=build --chown=heady:heady /app/node_modules ./node_modules
COPY --from=build --chown=heady:heady /app/src ./src
COPY --from=build --chown=heady:heady /app/shared ./shared
COPY --from=build --chown=heady:heady /app/configs ./configs
COPY --from=build --chown=heady:heady /app/scripts ./scripts
COPY --from=build --chown=heady:heady /app/services ./services
COPY --from=build --chown=heady:heady /app/public ./public
COPY --from=build --chown=heady:heady /app/.heady ./.heady
COPY --from=build --chown=heady:heady /app/docs ./docs
COPY --from=build --chown=heady:heady /app/package.json ./
COPY --from=build --chown=heady:heady /app/heady-manager.js ./
COPY --from=build --chown=heady:heady /app/seventeen-swarm-orchestrator.js ./
COPY --from=build --chown=heady:heady /app/heady-registry.json ./

# Copy heady-hive-sdk if it exists (ignore if missing)
RUN mkdir -p ./heady-hive-sdk
COPY --from=build --chown=heady:heady /app/heady-hive-sdk/ ./heady-hive-sdk/

# Switch to non-root
USER heady

# Environment
ENV NODE_ENV=production
ENV HEADY_ENV=production
ENV PORT=3301

# V8 tuning: 512MB heap, optimized for server workload
ENV NODE_OPTIONS="--max-old-space-size=512 --optimize-for-size"

# Expose port
EXPOSE 3301

# Health check: liveness probe on /health/live
HEALTHCHECK --interval=13s --timeout=5s --start-period=34s --retries=3 \
  CMD curl -f http://localhost:3301/health/live || exit 1

# Use tini as PID 1 for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start Heady
>>>>>>> hc-testing/dependabot/docker/node-25-slim
CMD ["node", "heady-manager.js"]
