# ╔══════════════════════════════════════════════════════════════════╗
# ║  HEADY™ AI-IDE Server — Production Dockerfile                   ║
# ║  Cloud Run: ide.heady-ai.com                                    ║
# ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder               ║
# ╚══════════════════════════════════════════════════════════════════╝

FROM node:22-slim AS base
WORKDIR /app

# System deps for node-pty (terminal) and Git
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ git openssh-client curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Package install (cached layer)
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# App code
COPY . .

# Health check
HEALTHCHECK --interval=29s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Cloud Run expects PORT env
ENV PORT=8080
EXPOSE 8080

# Non-root user
RUN addgroup --system heady && adduser --system --ingroup heady heady
USER heady

CMD ["node", "--experimental-vm-modules", "heady-ide-server.js"]
