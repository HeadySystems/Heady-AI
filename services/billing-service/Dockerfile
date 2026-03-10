# billing-service — Stripe billing for HeadyEX marketplace
# Multi-stage build with distroless base for <100MB images
# Heady Systems Inc. — Eric Haywood

FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY . .

FROM gcr.io/distroless/nodejs20-debian12
WORKDIR /app
COPY --from=builder /app /app

ENV NODE_ENV=production
ENV SERVICE_HOST=0.0.0.0
EXPOSE 3364

HEALTHCHECK --interval=21s --timeout=3s --start-period=5s --retries=3 \
  CMD ["/nodejs/bin/node", "-e", "const h=require('http');h.get('http://0.0.0.0:3364/health',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>{const j=JSON.parse(d);process.exit(j.status==='healthy'?0:1)});}).on('error',()=>process.exit(1))"]

CMD ["index.js"]
