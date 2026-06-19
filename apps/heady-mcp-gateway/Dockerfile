# ╔══════════════════════════════════════════════════════════════════╗
# ║  HEADY™ MCP Gateway — Cloud Run image                             ║
# ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
# ╚══════════════════════════════════════════════════════════════════╝
FROM node:20-slim AS base
ENV NODE_ENV=production
WORKDIR /app

# Enable Corepack/pnpm to honor the workspace + lockfile.
RUN corepack enable

# Workspace manifests first for layer caching.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/phi-math/package.json        packages/phi-math/package.json
COPY packages/logger/package.json          packages/logger/package.json
COPY packages/memory-stream/package.json   packages/memory-stream/package.json
COPY packages/studio-registry/package.json packages/studio-registry/package.json
COPY apps/heady-mcp-gateway/package.json   apps/heady-mcp-gateway/package.json

RUN pnpm install --filter @heady-ai/heady-mcp-gateway... --frozen-lockfile --prod

# Source.
COPY packages/phi-math        packages/phi-math
COPY packages/logger          packages/logger
COPY packages/memory-stream   packages/memory-stream
COPY packages/studio-registry packages/studio-registry
COPY apps/heady-mcp-gateway   apps/heady-mcp-gateway

WORKDIR /app/apps/heady-mcp-gateway
# Cloud Run injects PORT; the server reads it. Health probe hits /health.
EXPOSE 8080
CMD ["node", "src/index.mjs"]
