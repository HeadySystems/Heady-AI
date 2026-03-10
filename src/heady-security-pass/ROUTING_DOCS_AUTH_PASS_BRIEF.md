# Routing, Docs, and Auth Hardening Brief

Work only in the canonical repo at `/home/user/workspace/heady_repo`.

## Context
- The user wants the next maximum-potential pass focused on site auth entry points, link health, domain routing correctness, and documentation discoverability.
- Keep prior bounded hardening work intact.
- Public uptime evidence is conflicted across earlier audits, so do not claim stable uptime.

## Latest public-site audit findings
From the latest browser audit captured in `/home/user/workspace/tool_calls/browser_task/output_mmkzou3g.json`:
- `headyme.com` loaded with unique HeadyMe content and visible Sign In plus Docs/Documentation links.
- `headysystems.com` loaded with unique HeadySystems content and visible Sign In plus Docs/Documentation links.
- `headyos.com` served HeadyMe content as an alias.
- `headyconnection.org` loaded with unique HeadyConnection content.
- `headyconnection.com` served HeadyMe content instead of HeadyConnection.
- `headyfinance.com` loaded with unique HeadyFinance content.
- `headyex.com` served HeadyMe content as an alias even though config marks exchange as planned.
- `admin.headysystems.com` rendered with `headyex.com` navigation paths, suggesting a routing/template configuration issue.

## Repo/config drift already identified
Likely affected files:
- `services/heady-web/src/services/domain-router.js`
- `services/heady-web/template-engine/site-router.js`
- `services/heady-web/template-engine/vertical-registry.json`
- `src/config/domain-registry.js`
- Docs discoverability surfaces under `docs/`, especially `docs/README.md`, `docs/QUICK_REFERENCE.md`, and `docs/runbooks/*.md`

Known drift signals from prior inspection:
- `services/heady-web/src/services/domain-router.js` omits several audited domains including `headyos.com`, `headyconnection.com`, `headyfinance.com`, `headyex.com`, and `admin.headysystems.com`.
- `services/heady-web/template-engine/site-router.js` claims broader support and falls back to `headyme.com` config for unknown domains, which likely causes alias behavior.
- `services/heady-web/template-engine/vertical-registry.json` says `headyconnection.com` is canonical while `.org` is alias; marks `headyex.com` and `headyfinance.com` as planned; and points `headysystems.com` at `headyme/config.json`.
- `src/config/domain-registry.js` also lacks several live domains.

## Required work
1. Inspect the current routing, registry, template, and docs surfaces in the canonical repo.
2. Make a safe bounded fix batch that improves domain mapping consistency, reduces wrong HeadyMe fallback behavior, and improves docs discoverability/ease of navigation.
3. Add targeted tests for the new routing/docs behavior.
4. Update these docs with accurate findings:
   - `CHANGES.md`
   - `GAPS_FOUND.md`
   - `IMPROVEMENTS.md`
   - `HEADY_NEXT_ACTIONS.md`
   - `/home/user/workspace/heady_max_potential_results.md`
   - `LIVE_SITE_AUDIT_NOTES.md` if needed
5. Re-run the relevant test suite and report exact pass counts.

## Constraints
- Stay inside `/home/user/workspace/heady_repo` only.
- Do not touch archive or mirrored trees.
- Do not claim stable public uptime.
- If a fix is blocked by missing infra access or ambiguity, document the exact next operator action rather than inventing behavior.
- Preserve the user’s requirement that docs be easily accessible, comprehensive, and easy to understand.
