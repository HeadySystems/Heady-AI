FROM node:22-slim AS base
RUN npm install -g pnpm@9.15.0
WORKDIR /app

# Copy the entire workspace
COPY . .

# Set correct ownership to the node user
RUN chown -R node:node /app

# Install dependencies using pnpm workspace filtering and skip scripts
RUN pnpm install --filter=@heady-ai/heady-auth... --prod --ignore-scripts

ENV NODE_ENV=production
ENV SERVICE_NAME=heady-auth
ENV PORT=3309
ENV SERVICE_VERSION=3.2.3
ENV HEADY_DOMAIN=headysystems.com

EXPOSE 3309
EXPOSE 9464

USER node
WORKDIR /app/services/heady-auth
CMD ["node", "--experimental-vm-modules", "src/index.js"]
