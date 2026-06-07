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
<!-- ║  FILE: prompts/perplexity/PROMPT-07-cicd-security-observability.md                                                    ║
<!-- ║  LAYER: root                                                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
# PROMPT 7: CI/CD Pipeline, Security Hardening & Observability

## For: Perplexity Computer

## Objective: Build production-grade CI/CD, security scanning, and full observability stack

---

## INSTRUCTIONS FOR PERPLEXITY COMPUTER

You are hardening the Heady™ platform for production. This means CI/CD pipelines that catch everything, security scanning that misses nothing, and observability that sees everything.

**READ THE ATTACHED CONTEXT FILES FIRST** — especially `00-HEADY-MASTER-CONTEXT.md`, `cloudbuild.yaml`, and `docker-compose.production.yml`.

### TASK 1: GitHub Actions CI/CD Pipeline

Create/update `.github/workflows/ci.yml`:

```yaml
name: Heady CI/CD Pipeline
on:
  push:
    branches: [main, staging, develop]
  pull_request:
    branches: [main, staging]

jobs:
  # Phase 1: Lint + Type Check
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit

  # Phase 2: Security Scanning
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - name: TruffleHog Secret Scan
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.before }}
      - name: npm audit
        run: npm audit --audit-level=high
      - name: CodeQL SAST
        uses: github/codeql-action/analyze@v3
      - name: Dependency Review
        uses: actions/dependency-review-action@v4

  # Phase 3: Test Suite  
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_DB: heady_test
          POSTGRES_USER: heady_test
          POSTGRES_PASSWORD: test
        ports: ['5432:5432']
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm test -- --coverage
      - name: Upload Coverage
        uses: codecov/codecov-action@v4

  # Phase 4: Build + Container Scan
  build:
    needs: [lint, security, test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build Docker Image
        run: docker build -f Dockerfile.production -t heady-systems:${{ github.sha }} .
      - name: Trivy Container Scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: heady-systems:${{ github.sha }}
          severity: CRITICAL,HIGH
      - name: Generate SBOM
        run: npx @cyclonedx/cyclonedx-npm --output-file sbom.json

  # Phase 5: Deploy (main branch only)
  deploy:
    needs: [build]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      - uses: google-github-actions/setup-gcloud@v2
      - name: Deploy to Cloud Run
        run: |
          for service in heady-brain heady-conductor heady-mcp heady-onboarding heady-buddy; do
            gcloud run deploy $service --source services/$service --region us-east1 --allow-unauthenticated --quiet
          done
      - name: Deploy Cloudflare Workers
        run: |
          cd workers && npx wrangler deploy
          cd ../cloudflare/worker-heady-router && npx wrangler deploy
      - name: Smoke Tests
        run: npm run validate:endpoints
```

### TASK 2: Pre-Commit Hooks

Create `.githooks/pre-commit`:

- Run TruffleHog on staged files (catch secrets before commit)
- Run ESLint on staged JS/TS files
- Check for `localhost` references in staged files
- Check for magic numbers (non-Fibonacci) in staged files
- Check for placeholder/TODO comments

### TASK 3: Security Hardening

Audit and fix across entire codebase:

1. **Secret Scanning** — Ensure NO API keys, tokens, or passwords are in committed files
   - Scan for patterns: `sk-`, `gsk_`, `AIza`, `ghp_`, `Bearer`, base64-encoded secrets
   - All secrets must be in `.env` (gitignored) or GCP Secret Manager

2. **CORS Configuration** — Every API endpoint must have proper CORS:

   ```javascript
   const ALLOWED_ORIGINS = [
     'https://headyme.com', 'https://headysystems.com', 'https://headyos.com',
     'https://headybuddy.org', 'https://headyconnection.org', 'https://headymcp.com',
     'https://headyio.com', 'https://headyapi.com', 'https://heady-ai.com'
   ];
   ```

3. **Rate Limiting** — Every service must have Fibonacci-scaled rate limits
4. **Input Validation** — Every API endpoint validates input (no SQL injection, XSS)
5. **mTLS** — Service-to-service communication uses mutual TLS
6. **Helmet** — All Express apps use helmet() middleware

### TASK 4: Observability Stack

Build complete observability for all services:

1. **Structured Logging** — Every service uses the unified logger:

   ```javascript
   const { createLogger } = require('@heady-ai/observability-kernel');
   const log = createLogger('heady-brain', { phi: 1.618 });
   log.info('Service started', { port: 8080, version: '3.2.3' });
   ```

2. **Health Checks** — Every service implements:
   - `/health/live` — Is the process running?
   - `/health/ready` — Can it handle requests? (DB connected, deps available)
   - `/health/startup` — Has it fully initialized?

3. **OpenTelemetry Tracing** — Every HTTP handler has trace context:
   - Trace ID propagation across service calls
   - Span attributes include φ-scaled metrics
   - Export to `otel-collector` service

4. **Metrics Dashboard** — Build `services/heady-health/dashboard.html`:
   - Real-time health status of all 25 services
   - Response time histograms (φ-bucketed)
   - Error rate trends
   - Resource utilization (CPU/memory per service)

### TASK 5: Cloud Build Integration

Update `cloudbuild.yaml` for the full 5-phase pipeline:

1. Install + Lint
2. Security Scan (TruffleHog + npm audit)
3. Test + Coverage
4. Build + Container Scan
5. Deploy + Smoke Test

### DELIVERABLES

Create a ZIP file named `07-cicd-security-observability.zip` containing:

- `.github/workflows/ci.yml` — Complete CI/CD pipeline
- `.github/workflows/security-scan.yml` — Dedicated security scan workflow
- `.githooks/pre-commit` — Pre-commit hook script
- `security-audit-report.md` — Every security issue found and fixed
- `cors-config.js` — Unified CORS configuration
- `observability-kernel/` — Complete logging, health, tracing package
- `health-dashboard.html` — Real-time monitoring dashboard
- `cloudbuild.yaml` — Updated Cloud Build config
- `smoke-tests/` — Endpoint smoke test scripts
