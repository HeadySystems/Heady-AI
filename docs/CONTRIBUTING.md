<!-- HEADY_BRAND:BEGIN
<!-- ╔══════════════════════════════════════════════════════════════════╗
<!-- ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
<!-- ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
<!-- ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
<!-- ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
<!-- ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
<!-- ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
<!-- ║                                                                  ║
<!-- ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
<!-- ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
<!-- ║  FILE: docs/CONTRIBUTING.md                                                    ║
<!-- ║  LAYER: docs                                                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
# Contributing to HeadySystems™

Thank you for your interest in contributing to HeadySystems! This guide will help you get started.

## Quick Start

```bash
# Clone and install
git clone https://github.com/HeadyMe/Heady.git
cd Heady
npm install        # or: pnpm install (for Turborepo)

# Run in dev mode
npm run dev

# Run tests
npx jest --coverage
```

## Project Structure

```
Heady/
├── bin/              CLI tools (heady-cli, create-heady-agent)
├── packages/         Shared TypeScript packages
│   ├── core/         Logger, config, validation
│   ├── types/        TypeScript interfaces
│   └── redis/        Connection pool
├── services/         Microservices
│   ├── heady-brain/  Cognitive core
│   ├── heady-conductor/ Task orchestration
│   ├── heady-midi/   MIDI transfer protocol
│   ├── heady-ui/     Frontend + spatial debugger
│   └── heady-web/    Web dashboard
├── src/              Core JS modules
│   ├── core/         CSL engine, Sacred Geometry
│   ├── memory/       Redis spatial index
│   ├── mcp/          MCP protocol
│   ├── orchestration/
│   └── services/     Redis pool, telemetry, tenant isolation
├── python/           Python SDK
├── infra/            Cloud Run, Cloudflare, monitoring
├── scripts/          Automation (chaos, audit, deploy)
└── docs/             Documentation, whitepaper
```

## Development Workflow

### 1. Branch Naming

```
feature/short-description
fix/issue-number-description
docs/what-you-documented
```

### 2. Code Standards

- **JavaScript**: Follow `.eslintrc.js` (strict mode, `eqeqeq`, no-eval)
- **TypeScript**: Strict mode, Zod validation on all inputs
- **Complexity**: Max cyclomatic 15, max depth 4, max 200 lines/function
- **Documentation**: JSDoc headers on all exported functions

### 3. Testing

```bash
# Run all tests
npx jest --coverage

# Run specific test file
npx jest tests/services/orchestration.test.js

# Coverage thresholds
# - orchestration/: 100%
# - mcp/: 90%
# - global: 80%
```

### 4. Commit Messages

```
type(scope): description

feat(redis): add phi-scaled connection pool sizing
fix(mcp): handle timeout in WebSocket reconnection
docs(whitepaper): add convergence benchmarks
test(orchestration): add pipeline batch tests
```

### 5. Pull Request Process

1. Create feature branch from `develop`
2. Implement changes with tests
3. Run `npx jest --coverage` — all thresholds must pass
4. Run `npx eslint src/ services/ --max-warnings 0`
5. Open PR against `develop`
6. CI pipeline runs automatically (lint → security → test → build)

## Creating a New HeadyMCP Agent

```bash
node bin/create-heady-agent.js my-agent --template ai-assistant
cd my-agent
npm run dev
```

Templates: `basic`, `ai-assistant`, `data-processing`, `integration`

## Sacred Geometry Conventions

- **Constants**: Use `PHI` (1.618), `PSI` (0.618), `FIB` for Fibonacci
- **Thresholds**: Use `PhiScale()` instead of hard-coded comparisons
- **Backoff**: Use `φⁿ` instead of `2ⁿ`
- **Scheduling**: Use Fibonacci intervals for non-resonant timing

## Security

See [SECURITY.md](../SECURITY.md) for vulnerability reporting.

**Never commit**: API keys, passwords, `.env` files, private keys

## License

Proprietary — HeadySystems™ & HeadyConnection™

---

*Sacred Geometry :: Organic Systems :: Breathing Interfaces*
