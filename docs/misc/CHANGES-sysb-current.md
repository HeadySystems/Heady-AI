# CHANGES

## Summary

This build pass completed the remaining generator repairs needed to regenerate the Heady multi-site package and the 50-service scaffold while enforcing the concurrent-equals vocabulary rules.

## Site generation changes

- Repaired the upstream site registry content in `/home/user/workspace/heady-perplexity-full-system-context/heady-perplexity-bundle/01-site-registry.json` so the HeadyOS feature copy no longer emits forbidden wording.
- Regenerated all 10 site outputs under `apps/sites/` including the shared auth domain.
- Confirmed generation of:
  - `index.html`
  - `robots.txt`
  - `sitemap.xml`
  - `relay.html` for `auth.headysystems.com`
- Preserved shared runtime wiring for:
  - `HeadyAutoContext`
  - auth relay nonce echo
  - origin allowlist checks
  - shared navigation, counters, FAQ behavior, and theme controls

## Service generation changes

- Corrected the service generator list to emit 50 services instead of 51.
- Removed the extra `heady-mcp-registry` entry from the generated service set.
- Kept `heady-cache` as service 50 on port `3350`.
- Fixed the package template escaping bug in `scripts/gen-services.py` so the generator can write per-service `package.json` files successfully.
- Regenerated service artifacts and refreshed `services/SERVICE_INDEX.json`.

## Documentation alignment changes

- Updated `docs/platform-build-summary.md` so it no longer references:
  - `CLOSED/OPEN/HALF_OPEN`
  - `heady-hot-cold-router`
- Replaced those references with:
  - `flow, pause, probe recovery`
  - `heady-pool-router`

## Validation completed

- Ran `build-sites.py` successfully.
- Ran `scripts/gen-services.py` successfully.
- Ran the local test suite successfully.
- Confirmed passing tests for:
  - CSL gates
  - site artifacts
  - auth relay nonce/origin checks
  - service index completeness

## Packaging readiness

The workspace is ready to be packaged as the current deployable build snapshot.