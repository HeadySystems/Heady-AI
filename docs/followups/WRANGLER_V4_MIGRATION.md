# Wrangler v3 → v4 Migration

**Status:** Planned  
**Priority:** Medium  
**Opened:** 2026-06-18  
**Reason:** Security — clears Dependabot alerts for ws, undici, tar, esbuild  

## Background

The following Dependabot alerts were dismissed as `tolerable_risk` because they are
dev-only transitive dependencies pinned by wrangler@3.x / miniflare@3.x / node-gyp,
not production runtime code:

| Package | Old | Required | Pinned by |
|---------|-----|----------|-----------|
| ws | 8.18.0 | >=8.21.0 | miniflare@3.x |
| undici | 5.29.0 | >=6.24.0 | miniflare@3.x |
| esbuild | 0.17.19 | >=0.25.0 | wrangler@3.x |
| tar | 6.2.1 | >=7.5.8 | node-gyp@9.4.1, cacache@16.1.3 |

Wrangler v4 ships:
- esbuild@0.28.1 (was 0.17.x)
- miniflare@4.x with ws@8.21.0 + undici@7.28.0

## Affected packages.json

- `apps/heady-portal-gateway/package.json` — `wrangler: "^3.90.0"`
- `apps/heady-portal-proxy/package.json` — `wrangler: "^3.90.0"`
- `apps/heady-edge-gatekeeper/package.json` — `wrangler: "^3.114.17"`

## Migration Steps

1. Read [Wrangler v4 migration guide](https://developers.cloudflare.com/workers/wrangler/migration/migrating-from-wrangler-3/)
2. Update `wrangler` to `^4.0.0` in all 3 apps
3. Migrate `wrangler.toml` format changes (if any — v4 uses new config fields)
4. Test `wrangler dev` and `wrangler deploy --dry-run` for each app
5. Run `pnpm install` to regenerate lockfile with patched transitive deps
6. Verify Dependabot alerts auto-close after push

## Notes

- `node-gyp@9.4.1` still pins `cacache@16.1.3 → tar@6.2.1`. Upgrading `node-gyp` to v10
  will pick up `cacache@18+` with `tar@7.x`. Check if `node-gyp` is a direct dep anywhere.
- `cloudflare/heady-edge-node` is a legacy directory — its wrangler version is irrelevant.
