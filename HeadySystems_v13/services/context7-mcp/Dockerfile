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
# ║  FILE: HeadySystems_v13/services/context7-mcp/Dockerfile                                                    ║
# ║  LAYER: root                                                  ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END
# ─────────────────────────────────────────────────────────────────────────────
# Context7 MCP Service — HeadySystems_v13
# Port: 3371 | Layer: Outer | Node: BRIDGE | Pool: Warm
#
# © 2026 HeadySystems Inc. — Eric Haywood, Founder
# ─────────────────────────────────────────────────────────────────────────────

FROM node:20-alpine

LABEL maintainer="HeadySystems Inc. <eric@headyconnection.org>"
LABEL description="Context7 Documentation Server — real-time library docs for Heady agents"
LABEL version="1.0.0"
LABEL sacred_geometry.layer="Outer"
LABEL sacred_geometry.node="BRIDGE"
LABEL sacred_geometry.pool="Warm"

WORKDIR /app

# Install dependencies first (layer caching)
COPY package.json package-lock.json* ./
RUN npm ci --only=production && npm cache clean --force

# Copy application source
COPY server.js ./

# Create non-root user
RUN addgroup -g 1001 -S heady && \
    adduser -S heady -u 1001 -G heady

USER heady

EXPOSE 3371

# Health check using /health endpoint — interval 55s (FIB[9])
HEALTHCHECK --interval=55s --timeout=34s --start-period=13s --retries=8 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3371/health || exit 1

ENV NODE_ENV=production
ENV PORT=3371

CMD ["node", "server.js"]
