# heady-web runbook

## Symptoms
- projected sites fail to render or return outdated content
- domain health checks report unreachable or degraded public pages
- smoke or content validation fails after a site projection run

## Diagnosis
1. Run `node ./scripts/project-sites.js --verbose` to verify site projection output.
2. Check domain validation and health-check scripts for the failing hostname.
3. Confirm the site registry and generated service manifests still align.
4. Inspect recent SEO, structured data, or deployment changes for broken routes.

## Remediation
- Re-project sites from the registry and redeploy the affected surface.
- Fix broken route or domain configuration and rerun validation.
- Restore the last known-good site output if the latest projection introduced regressions.
- Keep static assets and generated pages in sync with the canonical registry rather than editing outputs directly.

## Post-incident review
- Capture which domain or projection step failed.
- Add a validation rule if the issue was caused by drift between registry data and generated output.
- Update deployment notes for any domain-specific edge case discovered.
