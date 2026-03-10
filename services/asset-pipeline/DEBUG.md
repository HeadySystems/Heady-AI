# asset-pipeline — Debug Guide

## Health Check
```bash
curl http://localhost:3417/health
```

## Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3417 | Service port |
| NODE_ENV | development | Environment |
| LOG_LEVEL | INFO | Structured log level |

## Common Issues
1. **Connection refused** — Ensure port 3417 is free
2. **Auth failures** — Verify JWT_SECRET env var matches auth-session-server
3. **Timeout** — Check upstream service health endpoints

## Logs
```bash
docker logs asset-pipeline --tail 100 -f
```
