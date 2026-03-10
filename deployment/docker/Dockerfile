# HEADY™ Production Dockerfile
# φ-compliant resource limits

FROM node:20-slim AS base
WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile --prod

# Copy production code
COPY shared/ ./shared/
COPY src/ ./src/
COPY configs/ ./configs/
COPY workers/ ./workers/

# Health check endpoint
HEALTHCHECK --interval=34s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8080}/health || exit 1

# No hardcoded ports — all from env
ENV NODE_ENV=production
EXPOSE ${PORT:-8080}

CMD ["node", "src/core/heady-manager.js"]
