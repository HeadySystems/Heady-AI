FROM node:22-slim AS runtime
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY src/ ./src/
ENV NODE_ENV=production
ENV PORT=3330
EXPOSE 3330
HEALTHCHECK --interval=30s --timeout=5s CMD curl -f http://localhost:3330/health || exit 1
CMD ["node", "src/server.js"]
