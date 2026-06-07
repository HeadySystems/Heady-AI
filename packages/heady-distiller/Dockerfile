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
# ║  FILE: packages/heady-distiller/Dockerfile                                                    ║
# ║  LAYER: root                                                  ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END
# ─────────────────────────────────────────────────────────────────────────────
# HeadyDistiller — Stage 22 Knowledge Distillation Engine
# Multi-stage production Dockerfile
# © 2026 HeadySystems Inc. — Eric Haywood, Founder — 60+ Provisional Patents
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: deps ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Copy lockfiles first for layer caching
COPY package.json package-lock.json ./

# Install production dependencies only — no devDependencies in runtime image
RUN npm ci --omit=dev

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

# Install curl for HEALTHCHECK (alpine does not ship it by default)
RUN apk add --no-cache curl

# Create non-root user and group for security hardening
RUN addgroup -S heady && adduser -S heady -G heady

WORKDIR /app

# Copy production node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY shared/ ./shared/
COPY src/ ./src/

# Copy package.json so Node can resolve package metadata at runtime
COPY package.json ./

# ── Environment ───────────────────────────────────────────────────────────────
ENV NODE_ENV=production \
    PORT=3375

EXPOSE 3375

# ── Health Check ──────────────────────────────────────────────────────────────
# Fibonacci-derived intervals: every 21s, start timeout 13s, retries 3
# 21 = fib(8), 13 = fib(7), 3 = fib(4)
HEALTHCHECK \
  --interval=21s \
  --timeout=13s \
  --start-period=13s \
  --retries=3 \
  CMD curl -f http://0.0.0.0:${PORT}/healthz || exit 1

# ── Drop privileges ───────────────────────────────────────────────────────────
USER heady

# ── Entrypoint ────────────────────────────────────────────────────────────────
CMD ["node", "src/index.js"]
