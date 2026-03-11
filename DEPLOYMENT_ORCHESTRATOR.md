# Heady™ Deployment Orchestrator & Startup Scripts

Complete deployment infrastructure for the Heady™ MCP Server platform, including unified startup scripts, validation tools, Docker orchestration, and Make targets.

## Overview

The deployment orchestrator provides a comprehensive suite of tools for managing the Heady™ MCP Server lifecycle:

- **Master Startup Script** (`heady-start.sh`) - Unified server initialization
- **Validation Script** (`heady-validate.sh`) - Pre-flight checks and diagnostics
- **Docker Helper** (`heady-docker.sh`) - Container management
- **Docker Compose** (`docker-compose.mcp.yml`) - Multi-service orchestration
- **Makefile** (`Makefile`) - Unified build and deployment targets

## Files Created

### 1. `/scripts/heady-start.sh` (7.7 KB)

Master startup script that orchestrates the complete MCP server initialization.

**Features:**
- Validates Node.js version >= 20.0.0
- Checks MCP service directory and package.json
- Automatically installs dependencies if node_modules is missing
- Loads environment variables from `.env` file
- Supports three transport modes: stdio, http, sse
- Comprehensive error messages and health checks
- Color-coded output for clarity

**Usage:**
```bash
# Start with default stdio transport
./scripts/heady-start.sh

# Start with HTTP transport (port 3310)
./scripts/heady-start.sh http

# Start with SSE transport (Server-Sent Events)
./scripts/heady-start.sh sse

# Show help
./scripts/heady-start.sh --help
```

**Validation Checks:**
1. Node.js version check
2. MCP service directory exists
3. package.json validation
4. Dependencies installation
5. Environment variable loading
6. Transport mode validation

### 2. `/scripts/heady-validate.sh` (11.1 KB)

Comprehensive validation and health-check script for all MCP components.

**Features:**
- Validates all required files exist
- Checks JavaScript syntax with `node --check`
- Validates JSON syntax in config files
- Runs registry validation tests
- Verifies package dependencies
- Generates detailed validation report
- Exit codes: 0 (all pass), 1 (any failures)

**Validation Sections:**
1. Core Service Files (src/index.js, package.json, Dockerfile)
2. Configuration Files (phi-constants.js, services.js)
3. Tool Files (service-client.js, registry.js, drupal-integration.js)
4. Transport Implementations (stdio.js, http.js)
5. Middleware (circuit-breaker, rate-limiter, logger, graceful-shutdown)
6. JavaScript Syntax Validation
7. JSON Syntax Validation
8. Package Dependencies
9. Registry Validation

**Usage:**
```bash
# Run full validation
./scripts/heady-validate.sh

# Use in CI/CD
./scripts/heady-validate.sh && make test

# Pre-deployment check
make validate && make docker-build
```

**Sample Output:**
```
[✓] Node.js version compatible
[✓] File exists: src/index.js
[✓] JS syntax valid: Main entry point
[✓] Registry validation passed
────────────────────────────────────
Validation Summary
────────────────────────────────────
Total Checks:    42
Passed:          42
Failed:          0
```

### 3. `/scripts/heady-docker.sh` (8.7 KB)

Docker image building and container lifecycle management.

**Features:**
- Build Docker images with configurable tags
- Run containers with health checks
- Stop and clean up containers
- Stream container logs
- Check container health status
- Automatic image building if needed
- Environment variable configuration

**Actions:**
- `build` - Build the Docker image
- `run` - Build and run the container
- `stop` - Stop and remove container
- `logs` - Stream container logs
- `status` - Show container status
- `health` - Run health checks
- `help` - Display help

**Usage:**
```bash
# Build the Docker image
./scripts/heady-docker.sh build

# Build and run (starts server on port 3310)
./scripts/heady-docker.sh run

# Run with custom configuration
CONTAINER_PORT=3310 HOST_PORT=8080 TRANSPORT=sse ./scripts/heady-docker.sh run

# Check health
./scripts/heady-docker.sh health

# View logs
./scripts/heady-docker.sh logs

# Stop and cleanup
./scripts/heady-docker.sh stop
```

**Environment Variables:**
- `DOCKER_IMAGE` - Image name (default: heady-mcp-server)
- `DOCKER_TAG` - Image tag (default: latest)
- `CONTAINER_NAME` - Container name (default: heady-mcp-server)
- `CONTAINER_PORT` - Port inside container (default: 3310)
- `HOST_PORT` - Port on host machine (default: 3310)
- `TRANSPORT` - Server transport: stdio, http, sse (default: http)

### 4. `/docker-compose.mcp.yml` (3.9 KB)

Docker Compose configuration for multi-service orchestration.

**Services:**
1. **heady-mcp-server** (Port 3310)
   - Main MCP service with 42 tools
   - Health checks enabled
   - Phi-scaled routing and CSL gates
   - Automatic dependency installation

2. **heady-brain** (Port 3311)
   - Cognitive reasoning engine
   - Depends on MCP server
   - Placeholder service for future development

3. **heady-memory** (Port 3312)
   - Distributed memory and context persistence
   - Depends on MCP server
   - Placeholder service for future development

**Features:**
- Shared network: heady-net (172.20.0.0/16)
- Health checks with auto-restart
- Structured logging with rotation
- Volume mounts for logs and cache
- Environment variable support from .env
- Service dependencies managed correctly

**Usage:**
```bash
# Start all services
docker-compose -f docker-compose.mcp.yml up -d

# View logs
docker-compose -f docker-compose.mcp.yml logs -f heady-mcp-server

# Stop all services
docker-compose -f docker-compose.mcp.yml down

# Check service status
docker-compose -f docker-compose.mcp.yml ps
```

### 5. `/Makefile` (6.2 KB)

Unified build and deployment targets with color-coded output.

**Startup Targets:**
- `make start` - Start MCP server (stdio)
- `make start-http` - Start MCP server (HTTP)
- `make start-sse` - Start MCP server (SSE)

**Validation & Testing:**
- `make test` - Run all tests
- `make validate` - Validate configuration
- `make smoke` - Run smoke tests

**Docker Targets:**
- `make docker-build` - Build Docker image
- `make docker-up` - Start services
- `make docker-down` - Stop services
- `make docker-logs` - View logs
- `make docker-status` - Show status
- `make docker-health` - Health checks

**Build Targets:**
- `make bootstrap` - Install dependencies
- `make build` - Build project
- `make predeploy` - Pre-deployment checks

**Maintenance:**
- `make clean` - Remove build artifacts
- `make help` - Display this help

**Usage Examples:**
```bash
# Start development server
make start

# Validate and test
make validate && make test

# Full Docker deployment
make docker-build && make docker-up

# Health check and logs
make docker-health && make docker-logs

# Clean and rebuild
make clean && make bootstrap && make build

# View available targets
make help
```

## Quick Start Guide

### 1. Basic Startup (Development)

```bash
cd /sessions/sweet-wonderful-carson/heady-repo

# Validate the environment
make validate

# Start the server
make start

# Or with HTTP transport
make start-http
```

### 2. Docker Deployment (Production)

```bash
cd /sessions/sweet-wonderful-carson/heady-repo

# Build and start all services
make docker-build
make docker-up

# Verify health
make docker-health

# View logs
make docker-logs
```

### 3. Full Deployment Pipeline

```bash
# 1. Validate everything
make validate

# 2. Run tests
make test

# 3. Build Docker image
make docker-build

# 4. Start services
make docker-up

# 5. Health check
make docker-health
```

## Environment Configuration

### Required Environment Variables

Create a `.env` file in the repo root with:

```bash
# API Configuration
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_ORG_ID=your-org-id

# Server Configuration
NODE_ENV=production
PORT=3310
HEADY_MCP_TRANSPORT=http

# Optional
LOG_LEVEL=info
HEADY_ENV=production
```

### Load from File

All scripts automatically load from `.env`:

```bash
# In scripts/heady-start.sh
source "${REPO_ROOT}/.env"

# In docker-compose.mcp.yml
- ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
```

## Service Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Heady™ Platform                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────────────────────────────────────┐ │
│  │ heady-mcp-server (Port 3310)                     │ │
│  │ - Master Control Program                         │ │
│  │ - 42 integrated tools                            │ │
│  │ - Phi-scaled routing                             │ │
│  │ - CSL gates                                      │ │
│  │ - Three transports: stdio/http/sse               │ │
│  └──────────────────────────────────────────────────┘ │
│           ↑                              ↑             │
│    ┌──────┴──────┬──────────┬───────────┘              │
│    │             │          │                          │
│  ┌─┴────────┐ ┌──┴─────┐ ┌──┴─────┐                   │
│  │ Services │ │ Tools  │ │ Config  │                   │
│  └──────────┘ └────────┘ └─────────┘                   │
│                                                         │
└─────────────────────────────────────────────────────────┘

Optional Services (Placeholders):
  - heady-brain (3311) - Cognitive engine
  - heady-memory (3312) - Context persistence
```

## Health Checks

All services include comprehensive health checks:

### MCP Server Health Check
```bash
curl http://localhost:3310/health

# Expected response:
{
  "status": "healthy",
  "version": "5.0.0",
  "uptime": 3600
}
```

### Full Health Check
```bash
make docker-health

# Output:
[✓] heady-mcp-server is healthy
[✓] heady-brain is running
[✓] heady-memory is running
[✓] All services healthy
```

## Troubleshooting

### Script Not Executable
```bash
chmod +x ./scripts/heady-start.sh
chmod +x ./scripts/heady-validate.sh
chmod +x ./scripts/heady-docker.sh
```

### Node.js Version Check Failed
```bash
# Verify Node.js >= 20
node --version

# Install or upgrade Node.js
nvm install 20
nvm use 20
```

### Dependencies Missing
```bash
# The startup script should handle this automatically
# Or manually install:
cd services/heady-mcp-server
npm install
```

### Docker Issues
```bash
# Check Docker is running
docker ps

# Rebuild image
make docker-build

# Check logs
make docker-logs

# Clean and restart
make docker-down
make docker-build
make docker-up
```

### Port Already in Use
```bash
# Check what's using port 3310
lsof -i :3310

# Use different port
HOST_PORT=8080 ./scripts/heady-docker.sh run
```

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Heady Deploy

on: [push]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '20'

      - name: Validate
        run: make validate

      - name: Test
        run: make test

      - name: Build Docker
        run: make docker-build

      - name: Deploy
        run: make docker-up

      - name: Health Check
        run: make docker-health
```

## Performance Considerations

### Resource Requirements

- **CPU:** 2+ cores recommended
- **Memory:** 1GB minimum, 2GB recommended
- **Disk:** 500MB for images and logs

### Optimization Tips

1. Use HTTP transport for better performance
2. Enable gzip compression
3. Use Redis for caching
4. Monitor with observability tools
5. Set appropriate log levels

## Security Notes

- Never commit `.env` with real API keys
- Use environment-specific configurations
- Rotate API keys regularly
- Use health checks to detect issues
- Monitor logs for errors
- Validate all inputs

## Related Documentation

- MCP Server: `/services/heady-mcp-server/README.md`
- Configuration: `/services/heady-mcp-server/.env.example`
- Docker: `/services/heady-mcp-server/Dockerfile`
- Tests: `/services/heady-mcp-server/src/__tests__/`

## Support

For issues, questions, or contributions:
- GitHub: https://github.com/HeadyMe/Heady-pre-production
- Email: eric@headyconnection.org
- Docs: https://headymcp.com

---

**Version:** 1.0.0
**Created:** March 2026
**Heady™ Master Control Program**
