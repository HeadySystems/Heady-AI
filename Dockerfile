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

FROM node:22-alpine AS deps

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
COPY scripts/ ./scripts/

# Install production dependencies only
RUN npm ci --omit=dev

# ─── Stage 2: Build ──────────────────────────────────────────────────────────

FROM node:22-alpine AS build

WORKDIR /app

# Copy deps from stage 1
COPY --from=deps /app/node_modules ./node_modules

# Copy source
COPY . .

RUN npm run build || true

# ─── Stage 3: Production ─────────────────────────────────────────────────────

FROM node:22-alpine AS production

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
COPY --from=build --chown=heady:heady /app/assets ./assets
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

# Health check: liveness probe on /health
HEALTHCHECK --interval=13s --timeout=5s --start-period=34s --retries=3 \
  CMD curl -f http://localhost:3301/health || exit 1

# Use tini as PID 1 for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start Heady
CMD ["node", "heady-manager.js"]
