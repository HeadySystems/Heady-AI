# Heady Platform — Developer Onboarding Guide

## Welcome
Welcome to the Heady sovereign AI platform. This guide will help you set up your development environment, understand the architecture, and make your first contribution. All instructions assume macOS or Linux. Windows users should use WSL2.

## Prerequisites
- Node.js 20+ LTS
- Docker and Docker Compose
- Git with SSH key configured for HeadyMe organization
- PostgreSQL 16+ client tools (psql, pg_dump)
- gcloud CLI (authenticated to gen-lang-client-0920560496)
- wrangler CLI (authenticated to Cloudflare account 8b1fa38f282c691423c6399247d53323)

## Repository Setup
```bash
git clone git@github.com:HeadyMe/Heady-pre-production.git
cd Heady-pre-production
npm ci
cp .env.example .env
# Edit .env with your local configuration
```

## Architecture Overview
The Heady platform is organized into five layers:
1. **Edge Layer** (Cloudflare): Workers for sub-ms routing, Durable Objects for agent state, Pages for websites
2. **Gateway Layer**: Nginx reverse proxy + HeadyGateway (port 3340) for API routing
3. **Core Services**: 60+ Node.js microservices on ports 3310-3369
4. **Infrastructure**: PostgreSQL/pgvector, NATS JetStream, PgBouncer, Prometheus/Grafana
5. **Security**: Session server, RBAC, CSP middleware, vault client, audit logger

## Key Concepts
- **Phi-Math Foundation**: All constants derive from phi (1.618), psi (0.618), and Fibonacci numbers. See `shared/phi-math.js`.
- **CSL Engine**: Continuous Semantic Logic uses vector operations for routing decisions. See `shared/csl-engine.js`.
- **Sacred Geometry**: Node topology uses concentric rings with phi-derived resource allocation. See `shared/sacred-geometry.js`.
- **Bee Factory**: Dynamic agent worker pattern for spawning specialized AI workers. See `src/bees/bee-factory.js`.
- **Zero Magic Numbers**: Every constant must trace to phi, psi, Fibonacci, or phiThreshold(). No exceptions.
- **CommonJS**: All production code uses require/module.exports. No ESM import/export.
- **Structured Logging**: JSON-formatted logs only. No console.log in production code.
- **httpOnly Sessions**: Never store tokens in localStorage. httpOnly cookies exclusively.

## Running Locally
```bash
# Start infrastructure
docker-compose -f docker-compose.yml -f infrastructure/docker-compose.monitoring.yml up -d

# Start a single service
PORT=3310 node services/heady-soul/index.js

# Run all tests
node tests/runner.js

# Check phi-math constants
node scripts/verify-phi-constants.js
```

## Making Changes
1. Create a feature branch from develop
2. Implement changes following the Unbreakable Laws
3. Add tests (unit, contract, integration as appropriate)
4. Update documentation (CHANGELOG.md, ADRs for significant changes)
5. Run full test suite and security scan
6. Submit pull request with description of changes and any new phi-derived constants

## Coding Standards
- Full JSDoc on every function and class
- No TODO, FIXME, HACK, empty catch blocks
- Replace console.log with structured JSON logging
- "Eric Haywood" (not "Eric Head") in all attributions
- Replace priority/ranking language with concurrent-equals language
- All tests use Node.js built-in assert module (no external test frameworks)
