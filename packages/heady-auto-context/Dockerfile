# ═══════════════════════════════════════════════════════════
# HEADY™ AUTO-CONTEXT SERVICE — Production Dockerfile
# © 2026 HeadySystems Inc. — Eric Haywood, Founder
# Multi-stage build for minimal attack surface
# ═══════════════════════════════════════════════════════════

# ── Stage 1: Install dependencies ──────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev

# ── Stage 2: Production image ──────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Security: non-root user
RUN addgroup -g 1001 -S heady && \
    adduser -S heady -u 1001 -G heady

# Copy dependencies and source
COPY --from=deps /app/node_modules ./node_modules
COPY shared/ ./shared/
COPY src/ ./src/
COPY package.json ./

# Own everything to heady user
RUN chown -R heady:heady /app
USER heady

# Service port (Law 3: cloud-deployed, zero localhost)
EXPOSE 8907

# Health check — K8s liveness probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8907/healthz || exit 1

# Start
ENV NODE_ENV=production
ENV AUTOCONTEXT_PORT=8907
CMD ["node", "src/index.js"]
