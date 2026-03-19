# ╔══════════════════════════════════════════════════════════════════╗
# ║  HEADY SYSTEMS — MCP Backend Dockerfile (PRIVATE)              ║
# ║  Contains ALL proprietary code — NEVER publish this image      ║
# ║  Deploy ONLY to Cloud Run via gcloud run deploy                ║
# ╚══════════════════════════════════════════════════════════════════╝

FROM node:20-slim AS builder

WORKDIR /app

# Copy the full monorepo (proprietary packages)
COPY package.json package-lock.json* pnpm-lock.yaml* ./
COPY packages/ packages/
COPY mcp-servers/ mcp-servers/
COPY src/ src/

# Install dependencies
RUN npm install --production --ignore-scripts 2>/dev/null || \
    corepack enable && pnpm install --prod --frozen-lockfile 2>/dev/null || \
    echo "Using local node_modules"

# ── Production stage ──
FROM node:20-slim

WORKDIR /app

# Copy built artifacts
COPY --from=builder /app/ /app/

# Copy the backend server
COPY packages/mcp-server/backend/server.js /app/backend/server.js

ENV NODE_ENV=production
ENV PORT=8080
ENV HEADY_ROOT=/app

# Cloud Run health check
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD node -e "const http=require('http');http.get('http://localhost:8080/health',r=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

EXPOSE 8080

CMD ["node", "backend/server.js"]
