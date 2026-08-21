# ╔══════════════════════════════════════════════════════════════════╗
# ║  HEADY™ Canonical Manager Container v1.0.0                      ║
# ║  Node 22 + pnpm production image for apps/heady-manager.        ║
# ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder               ║
# ╚══════════════════════════════════════════════════════════════════╝

FROM node:22-slim AS dependencies

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY . .
RUN pnpm install --frozen-lockfile --prod --filter heady-manager...

FROM node:22-slim AS production

ENV NODE_ENV=production
ENV PORT=8080
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
COPY --from=dependencies --chown=node:node /app /app

USER node
EXPOSE 8080

# Cloud Run owns startup/liveness probes through Terraform. The container has
# no local state directories: logs go to structured stdout and durable records
# go to Neon through the manager's vault-resolved DbPort.
CMD ["node", "apps/heady-manager/src/index.mjs"]
