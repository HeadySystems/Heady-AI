FROM node:20-slim
WORKDIR /app
COPY package.json .
COPY dynamic-site-server.js .
ENV PORT=8080
CMD ["node", "dynamic-site-server.js"]
