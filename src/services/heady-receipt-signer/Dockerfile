FROM node:22-alpine AS base
WORKDIR /app
COPY package.json ./
COPY packages/platform/package.json ./packages/platform/
RUN npm install --workspace=packages/platform --omit=dev

FROM base AS production
COPY packages/platform/src ./packages/platform/src
COPY services/heady-receipt-signer/src ./src

ENV NODE_ENV=production
ENV SERVICE_NAME=heady-receipt-signer
ENV PORT=3338

EXPOSE 3338
EXPOSE 9464

HEALTHCHECK --interval=7s --timeout=4s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3338/health/live || exit 1

USER node
CMD ["node", "src/index.js"]
