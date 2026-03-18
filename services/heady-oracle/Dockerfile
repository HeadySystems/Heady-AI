FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV PORT=3373
EXPOSE 3373
CMD ["node", "src/index.js"]
