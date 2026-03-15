FROM node:22-alpine

WORKDIR /app

# Copy package files and install
COPY package.json package-lock.json* ./
RUN npm ci --only=production 2>/dev/null || npm install --only=production

# Copy service source
COPY server.js ./

# Copy core liquid node modules from monorepo
COPY ../../src/boot/wire-liquid-nodes.js ./src/boot/
COPY ../../core/liquid/ ./core/liquid/
COPY ../../core/liquid-nodes/ ./core/liquid-nodes/
COPY ../../core/constants/ ./core/constants/
COPY ../../src/utils/ ./src/utils/
COPY ../../configs/liquid-os-manifest.json ./configs/

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/_heady/health || exit 1

CMD ["node", "server.js"]
