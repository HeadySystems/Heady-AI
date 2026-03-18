FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV PORT=3372
EXPOSE 3372
CMD ["node", "src/index.js"]
