FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

FROM node:20-alpine
WORKDIR /app
RUN addgroup -g 1001 heady && adduser -u 1001 -G heady -s /bin/sh -D heady
COPY --from=builder --chown=heady:heady /app .
USER heady
ENV NODE_ENV=production
ENV PORT=3341
ENV SERVICE_NAME=heady-sims
EXPOSE 3341
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -qO- http://localhost:3341/health/live || exit 1
CMD ["node", "index.js"]
