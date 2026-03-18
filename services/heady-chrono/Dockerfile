FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV PORT=3371
EXPOSE 3371
CMD ["node", "src/index.js"]
