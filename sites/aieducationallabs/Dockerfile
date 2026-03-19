FROM node:18-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .

FROM gcr.io/distroless/nodejs18-debian12
WORKDIR /app
COPY --from=build /app /app
EXPOSE 8080
CMD ["server.js"]
