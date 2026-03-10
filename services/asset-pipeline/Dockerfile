FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3417
ENV PORT=3417
CMD ["node", "server.js"]
