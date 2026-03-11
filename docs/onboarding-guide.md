# Heady™ Developer Onboarding Guide

## Welcome
Welcome to Heady — the concurrent-equals AI platform built on sacred geometry and φ-scaled intelligence.

## Prerequisites
- Node.js 20+
- npm 10+
- Git
- Optional: Docker, gcloud CLI

## Quick Setup
```bash
# 1. Clone the repository
git clone https://github.com/HeadyMe/Heady.git
cd Heady

# 2. Run setup script
chmod +x scripts/setup-dev.sh
./scripts/setup-dev.sh

# 3. Start development
npm run dev
```

## Project Structure
```
Heady/
├── apps/           # User-facing applications
├── configs/        # Infrastructure, cloud, monitoring configs
├── docs/           # Documentation, ADRs, runbooks
├── migrations/     # Database migration SQL files
├── packages/       # Shared modules (logger, CORS, rate-limiter, etc.)
├── proto/          # gRPC protocol buffers
├── scripts/        # Dev tools, load testing, chaos engineering
├── services/       # Microservices (15 total)
├── sites/          # Website HTML (pricing, docs, status, blog, dev portal)
└── src/            # Core source code
```

## Key Modules
- **Structured Logger:** `require('../../packages/shared/structured-logger')` — always use instead of `console.log`
- **CORS Whitelist:** `require('../../packages/shared/cors-whitelist')` — approved origins
- **Rate Limiter:** `require('../../packages/shared/rate-limiter')` — φ-scaled rate limiting
- **Feature Flags:** `require('../../packages/shared/feature-flags')` — safe feature rollouts

## Running Tests
```bash
npm test                    # All tests
npx turbo run test          # Turbo-accelerated
node scripts/load-test.js   # Load testing
```

## Deploying
```bash
gcloud run deploy heady-<service> --source services/<service> --region us-central1
```

## Getting Help
- Check `DEBUG.md` in each service directory
- Review `ERROR_CODES.md` for error reference
- Read `docs/runbooks/` for operational procedures
