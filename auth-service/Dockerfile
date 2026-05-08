FROM node:22-alpine
WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application code
COPY src/ src/

# Environment
ENV NODE_ENV=production
ENV PORT=3309
ENV SERVICE_NAME=heady-auth

EXPOSE 3309

# Health check using phi-derived interval (fib(5)=5s interval, fib(3)=2s timeout)
HEALTHCHECK --interval=5s --timeout=2s --start-period=8s --retries=3 \
  CMD wget -qO- http://localhost:3309/health/live || exit 1

CMD ["node", "src/index.js"]
