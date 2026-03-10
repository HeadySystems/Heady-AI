# Deployment Runbook

## Document Information
- **Author**: Eric Haywood, HeadySystems Inc.
- **Version**: 4.0.0
- **Last Updated**: 2026-03-01

## Purpose
This runbook documents the standard deployment procedure for Heady platform services to Google Cloud Run (origin compute) and Cloudflare Workers (edge compute). It covers pre-deployment checks, deployment execution, post-deployment verification, and rollback procedures.

## Pre-Deployment Checklist

Before any deployment, verify:

1. **All tests pass**: Unit tests (`node tests/runner.js`), contract tests (`node tests/contracts/contract-runner.js`), and integration tests must pass with zero failures.
2. **Security scan clean**: `npm audit --production --audit-level=high` returns no high or critical vulnerabilities. Trivy container scan passes with CRITICAL and HIGH severity threshold.
3. **Schema compatibility**: New schemas must pass backward compatibility check against the schema registry. Breaking changes require a major version bump and migration plan.
4. **Feature flags configured**: New features must be behind feature flags with Fibonacci-stepped rollout percentages (0%, 5%, 8%, 13%, 21%, 34%, 55%, 89%, 100%).
5. **Phi-math constants verified**: Run `node scripts/verify-phi-constants.js` to confirm no magic numbers were introduced.
6. **Documentation updated**: CHANGELOG.md updated, ADRs written for significant architectural changes, API documentation reflects new endpoints.

## Deployment Procedure

### Cloud Run (Origin)

Cloud Run deployments use the CI/CD pipeline (`.github/workflows/heady-ci.yml`) for automated deployment. Manual deployment is available for emergency fixes:

```bash
# Build the service image
IMAGE="gcr.io/gen-lang-client-0920560496/<service>:$(git rev-parse --short HEAD)"
docker build -t "${IMAGE}" -f services/<service>/Dockerfile .

# Push to GCR
docker push "${IMAGE}"

# Deploy to Cloud Run
gcloud run deploy <service>   --image "${IMAGE}"   --region us-east1   --platform managed   --memory 1Gi   --cpu 2   --min-instances 1   --max-instances 21   --set-env-vars "NODE_ENV=production"
```

Production deployments use Fibonacci-scaled instance limits: min-instances=1, max-instances=fib(8)=21. Memory allocation follows service tier: Hot pool services get 1Gi, Warm pool 512Mi, Cold pool 256Mi.

### Cloudflare Workers (Edge)

Edge deployments use Wrangler CLI:

```bash
# Deploy to staging
npx wrangler deploy --env staging

# Verify staging
curl -s https://staging.headysystems.com/edge/health

# Promote to production
npx wrangler deploy --env production
```

### Fibonacci-Stepped Rollout

New features deploy through Fibonacci-stepped percentage rollout:

1. **0%**: Feature deployed but disabled (behind feature flag)
2. **5%** (fib(5)): Internal team testing
3. **8%** (fib(6)): Beta users
4. **13%** (fib(7)): Early adopters
5. **21%** (fib(8)): Expanded testing
6. **34%** (fib(9)): Broad beta
7. **55%** (fib(10)): Majority rollout
8. **89%** (fib(11)): Near-complete rollout
9. **100%**: Full availability

Each step requires verification of error rates, latency percentiles, and user feedback before proceeding. Minimum soak time per step: fib(8) = 21 minutes for P1 services, fib(9) = 34 minutes for P2, fib(10) = 55 minutes for P3.

## Post-Deployment Verification

After every deployment:

1. **Health checks**: Verify liveness, readiness, and startup probes for the deployed service.
2. **Smoke tests**: Run `node tests/smoke/smoke-runner.js --service <service>` to verify basic functionality.
3. **Metrics baseline**: Confirm that error rates, latency percentiles (p50, p90, p99), and throughput are within historical norms.
4. **Coherence check**: Verify system coherence score remains above phiThreshold(2) = 0.809.
5. **Dependency health**: Verify that downstream services have not been impacted by the deployment.
6. **Audit log**: Confirm deployment event was recorded in the audit logger.

Monitor for fib(8) = 21 minutes before declaring the deployment successful.

## Rollback Procedures

If post-deployment verification fails:

### Automatic Rollback
The CI/CD pipeline automatically rolls back if smoke tests fail. Cloud Run maintains the previous revision and can instantly switch traffic back:

```bash
# List revisions
gcloud run revisions list --service <service> --region us-east1

# Route 100% traffic to previous revision
gcloud run services update-traffic <service>   --region us-east1   --to-revisions <previous-revision>=100
```

### Manual Rollback
For emergency rollbacks that bypass CI/CD:

```bash
# Identify the last known good revision
gcloud run revisions list --service <service> --region us-east1 --limit 5

# Immediate traffic switch
gcloud run services update-traffic <service>   --region us-east1   --to-revisions <known-good-revision>=100
```

After rollback, create an incident report documenting the failure mode, root cause, and corrective actions.

## Emergency Procedures

For P1 incidents affecting multiple services:

1. **Invoke incident commander**: The deploying engineer becomes incident commander.
2. **Freeze deployments**: No other deployments until incident is resolved.
3. **Communicate status**: Post to the status page and notify affected users.
4. **Follow Service Recovery Runbook**: Use RUNBOOK-service-recovery.md procedures for systematic recovery.
5. **Post-mortem**: Schedule a blameless post-mortem within 24 hours.
