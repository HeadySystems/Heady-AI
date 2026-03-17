# ─── Stage 1: Install dependencies ───────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

COPY server/package.json server/package-lock.json* ./
RUN npm ci --production --ignore-scripts && npm cache clean --force

# ─── Stage 2: Production image ──────────────────────────────────────────────
FROM node:20-alpine AS production

# Security: non-root user
RUN addgroup -g 1001 -S heady && \
    adduser -S heady -u 1001 -G heady

WORKDIR /app

# Copy dependencies from stage 1
COPY --from=deps --chown=heady:heady /app/node_modules ./node_modules

# Copy server source
COPY --chown=heady:heady server/ ./

# Switch to non-root user
USER heady

# Cloud Run expects PORT=8080
ENV PORT=8080
ENV NODE_ENV=production
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8080/health || exit 1

CMD ["node", "index.js"]
