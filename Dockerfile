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
# ║  FILE: Dockerfile                                                ║
# ║  LAYER: root                                                     ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END
FROM node:22-alpine AS deps

WORKDIR /app

# Install build essentials for native addons
RUN apk add --no-cache python3 make g++ git

# Copy package files
COPY package.json pnpm-lock.yaml* package-lock.json* yarn.lock* ./

# Install with preferred package manager
RUN if [ -f pnpm-lock.yaml ]; then \
      corepack enable && pnpm install --frozen-lockfile --prod; \
    elif [ -f yarn.lock ]; then \
      yarn install --production --frozen-lockfile; \
    else \
      npm install --omit=dev --ignore-scripts; \
    fi

# ─── Stage 2: Build ──────────────────────────────────────────────────────────

FROM node:22-alpine AS build

WORKDIR /app

# Copy deps from stage 1
COPY --from=deps /app/node_modules ./node_modules

# Copy source
COPY . .

# Run build if build script exists
RUN if grep -q '"build"' package.json; then \
      npm run build 2>/dev/null || true; \
    fi

# Prune dev dependencies
RUN if [ -f pnpm-lock.yaml ]; then \
      corepack enable && pnpm prune --prod; \
    else \
      npm prune --omit=dev 2>/dev/null || true; \
    fi

# Healthcheck moved to production stage

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
COPY --from=build --chown=heady:heady /app/public ./public
COPY --from=build --chown=heady:heady /app/.heady ./.heady
COPY --from=build --chown=heady:heady /app/docs ./docs
COPY --from=build --chown=heady:heady /app/package.json ./
COPY --from=build --chown=heady:heady /app/heady-manager.js ./
COPY --from=build --chown=heady:heady /app/seventeen-swarm-orchestrator.js ./
COPY --from=build --chown=heady:heady /app/heady-registry.json ./
COPY --from=build --chown=heady:heady /app/packages ./packages

# Link @heady/* and @heady-ai/* workspace packages into node_modules
# (workspace symlinks don't survive multi-stage Docker builds)
RUN for pkg_json in packages/*/package.json; do \
      pkg_dir=$(dirname "$pkg_json"); \
      pkg_name=$(node -e "console.log(require('./$pkg_json').name || '')" 2>/dev/null); \
      if [ -n "$pkg_name" ]; then \
        scope_dir="node_modules/$(echo $pkg_name | cut -d/ -f1)"; \
        mkdir -p "$scope_dir"; \
        ln -sf "../../$pkg_dir" "node_modules/$pkg_name"; \
      fi; \
    done && \
    mkdir -p node_modules/@heady && \
    for pkg in packages/*/; do \
      base=$(basename "$pkg"); \
      if [ ! -L "node_modules/@heady/$base" ]; then \
        ln -sf "../../$pkg" "node_modules/@heady/$base"; \
      fi; \
    done

# Copy heady-hive-sdk if it exists (ignore if missing)
RUN mkdir -p ./heady-hive-sdk
COPY --from=build --chown=heady:heady /app/heady-hive-sdk/ ./heady-hive-sdk/

# Switch to non-root
USER heady

# Environment
ENV NODE_ENV=production
ENV HEADY_ENV=production
ENV PORT=8080

# V8 tuning: 512MB heap, optimized for server workload
ENV NODE_OPTIONS="--max-old-space-size=512"

# Expose port
EXPOSE 8080

# Health check: liveness probe on /health/live
HEALTHCHECK --interval=13s --timeout=5s --start-period=34s --retries=3 \
  CMD curl -f http://localhost:${PORT}/health/live || exit 1

# Use tini as PID 1 for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start Heady
CMD ["node", "heady-manager.js"]
