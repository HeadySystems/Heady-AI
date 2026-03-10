# Heady Next Actions

## What remains blocked in this bounded pass

The canonical repo has been repaired enough to support a cleaner root workflow pass, but several maximum-potential requirements still require environment access, infrastructure ownership, or a larger dedicated remediation program.

## Do these next

### Secrets and certificate exposure
1. Treat the committed `.env` contents and any committed certificate/private-key material as compromised.
2. Rotate all affected provider keys, JWT secrets, database credentials, and certificates.
3. Remove exposed secrets from git history using a history-rewrite workflow.
4. Move all runtime secrets to Google Secret Manager or HashiCorp Vault.
5. Add CI rules that fail on `.env`, `*.key`, `*.pem`, and known secret patterns.

### Canonical tree reduction
1. Keep `/home/user/workspace/heady_repo` as the active source tree.
2. Inventory duplicate trees such as `_archive`, `Heady-pre-production-9f2f0642-main`, `heady-monorepo`, and `heady-enterprise`.
3. Decide whether each duplicate becomes archived, deleted, or promoted.
4. Remove duplicate trees from active build and validation surfaces before broad renames.

### Founder-name normalization
1. Run a controlled repo-wide pass replacing `Eric Head` and `Eric Headington` with `Eric Haywood`.
2. Review legal names, docs, generated content, and mirrored trees separately.
3. Re-run tests and validation after the rename wave.

### Service verification
1. Bring up the actual canonical runtime with the intended compose or orchestration path.
2. Set `SMOKE_BASE_URL` or `HEADY_PUBLIC_BASE_URL` to the real reachable gateway.
3. Run:
   - `npx jest tests/security-hardening-pass.test.js --runInBand`
   - `npx jest tests/production-hardening-batch7.test.js --runInBand`
   - `node ./scripts/validate-no-localhost.mjs`
   - `node ./scripts/generate-service-manifests.mjs`
   - `node ./scripts/smoke-test.mjs --base-url <real-url>`
4. Only treat smoke failures as application regressions after confirming the gateway hostname resolves from the execution environment.
5. Treat the current `docker-compose.yml` as a bounded local stack definition, not proof of all-50-service coverage.

### Infrastructure follow-through
1. Replace remaining local-development defaults in active configs with environment-driven internal service DNS or public production endpoints.
2. Validate nginx upstream naming against the actual deployed upstream blocks.
3. Validate OpenTelemetry exporters against the real collector endpoint.
4. Confirm Cloud Run, Workers, and site deployment wrappers target the intended production projects.

### Website, auth, and Drupal audit
1. Verify cross-domain auth propagation on the real hosted domains.
2. Validate cookie scope, `__Host-` usage, iframe relay origin checks, and logout propagation.
3. Validate Drupal content types, vector indexing hooks, and CMS clipboard integrations with the live CMS base URL.
4. Run accessibility, responsive, SEO, and structured-data checks on each active site.

### Public domain reachability (UPDATED — audit conflict requires revalidation)
1. Prior browser-visible audit recorded Cloudflare 522 on all eight public Heady domains, but the latest browser-visible audit shows all eight domains reachable or redirecting.
2. Treat this as conflicting evidence, not a resolved uptime claim.
3. Re-run browser-visible checks from at least one additional network vantage and compare results with direct origin checks before publishing any site-health statement.
4. Follow triage in `docs/runbooks/public-domain-health.md`: verify origin is running, check Cloudflare DNS/SSL settings, test origin directly, and capture timestamps for each verification pass.
5. Do not claim stable public site health until the conflict is reconciled and repeatable.

### Remaining CORS wildcard cleanup
1. ~~Fix wildcard CORS in `apps/headyweb/nginx.conf`, `apps/headyweb/webpack.config.js`, `webpack.config.js` (root), `templates/template-heady-ui/webpack.config.js`.~~ **Done in batch 6.**
2. ~~Fix wildcard CORS in `src/mcp/colab-mcp-bridge.js` SSE handler.~~ **Done in batch 4.**
3. ~~Audit `services/heady-security/middleware/cors-policy.js` for consistency with `src/middleware/security/cors-policy.js`.~~ **Batch 6 canonicalized the shared middleware; verify downstream imports before deleting extra service-local copies.**
4. ~~Remove duplicate `src/middleware/cors-policy.js` (byte-identical to `src/middleware/security/cors-policy.js`).~~ **Batch 6 kept `src/middleware/cors-policy.js` as canonical and converted `src/middleware/security/cors-policy.js` into a re-export.**
5. ~~Fix conditional wildcard fallback in `src/core/heady-api-gateway-v2.js` line 414.~~ **Done in batch 5.**

### Remaining silent failure path cleanup
1. ~~Address catches in `swarm-coordinator.js`, `src/services/heady-infer/providers/*.js`, `src/services/heady-infer/response-cache.js`, `src/projection/projection-swarm.js`, `src/projection/cloud-conductor-integration.js`.~~ **Done in batch 4.**
2. ~~`bin/heady-cli.js` (4 catches), `bin/cli-auth.js` (1 catch), `src/services/heady-auto-context.js` (6 catches), `services/heady-projection/index.js` (1 catch).~~ **Done in batch 5.**
3. Remaining intentional: `src/testing/integration-test-runner.js` (3 catches — test mechanics, should not be modified).

### Remaining structured logging migration
1. ~~`services/heady-vector/server.js`~~ **Done in batch 4.**
2. ~~`services/heady-web/template-engine/site-router.js`~~ **Done in batch 5.**
3. ~~`src/core/heady-api-gateway-v2.js`~~ **Done in batch 5.**
4. ~~`services/heady-web/src/vector-federation.js`~~ **Done in batch 6.**
5. ~~`services/heady-health/probe-orchestrator.js`~~ **Done in batch 7** with shared structured logger output and fibonacci-derived probe intervals/timeouts.
6. `services/heady-projection/index.js` uses a custom `log()` helper (acceptable — already writes structured-ish output with timestamps and levels).
7. Remaining high-value targets are active orchestration surfaces under `src/orchestration/` plus any health-operation modules promoted into the runtime path.
8. `services/heady-web/src/shell/index.js` is a browser module — `console.*` is appropriate for browser DevTools.
9. Consider creating a shared lightweight logger utility for services that don't already have one.

### Placeholder endpoint audit
1. `services/heady-projection/src/generate-bee.js` contains 10+ `// TODO` placeholder functions. These should either be wired or return 501.
2. ~~`services/heady-health/resilience/respawn-controller.js` and `quarantine-manager.js` have TODO placeholders.~~ **Hardened in batch 4 — now return false/log warnings instead of silently succeeding.**
3. `services/heady-onboarding/src/app/api/auth/callback/route.ts` — **batch 5 added `HEADY_REQUIRE_FIREBASE_ADMIN` gate** — but firebase-admin SDK integration itself still needs to be wired. Set `HEADY_REQUIRE_FIREBASE_ADMIN=true` only after completing the SDK integration.

### Domain routing follow-through (batch 8 partial)
1. ~~`domain-router.js` omitted 5 audited domains.~~ **Fixed in batch 8.**
2. ~~`vertical-registry.json` headysystems used headyme config_path.~~ **Fixed in batch 8.**
3. ~~`headyconnection` canonical/alias inverted (`.com` vs `.org`).~~ **Fixed in batch 8.**
4. ~~`admin.headysystems.com` was missing from all routing surfaces.~~ **Fixed in batch 8.**
5. ~~Silent fallback to headyme for unknown domains.~~ **Batch 8 added `vertical_default_fallback` structured warning.**
6. `headyex.com` and `headyfinance.com` are still marked `planned` in `vertical-registry.json`. If they should serve their own content, operator must update status to `active`, set `deployed_at`, and ensure the vertical config files exist. If they are intended as permanent headyme aliases, document that intent explicitly in the registry.
7. Verify that the `headysystems/config.json` file exists under the template-engine configs directory, or create it with appropriate HeadySystems-specific branding and content.

## Important note on smoke verification

The smoke suite is now structurally wired correctly, but its success still depends on a real reachable base URL. In this environment, the default public host did not resolve, so the smoke failure should currently be interpreted as an environment reachability blocker, not as proof that the application routes are broken.
