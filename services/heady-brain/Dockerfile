# HEADY_BRAND:BEGIN
# HeadyBrain - Cognitive core service
# HEADY_BRAND:END

FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install --production=false

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4325

COPY package.json ./
RUN npm install --production

COPY --from=builder /app/dist ./dist

EXPOSE 4325

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4325/health/ready || exit 1

CMD ["node", "dist/index.js"]
