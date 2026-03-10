# Live Site Audit Notes

## Evidence conflict
Two browser-visible audits now conflict and must both be preserved.

### Earlier browser-visible result
A prior browser-based live check found visible Cloudflare 522 timeouts for all of these public URLs in that browsing environment:
- https://headyme.com
- https://headysystems.com
- https://headyos.com
- https://headyconnection.org
- https://headyconnection.com
- https://headyfinance.com
- https://headyex.com
- https://admin.headysystems.com

### Latest browser-visible result
A later browser-based live check found all eight public domains reachable or redirecting:
- `headyme.com` loaded with title `HeadyMe — Your Sovereign AI`
- `headysystems.com` loaded with title `HeadySystems — The Architecture of Intelligence`
- `headyos.com` redirected to `headyme.com`
- `headyconnection.org` loaded with title `HeadyConnection — The Human Network`
- `headyconnection.com` redirected to `headyme.com`
- `headyfinance.com` redirected to `headyme.com`
- `headyex.com` redirected to `headyme.com`
- `admin.headysystems.com` redirected to `headyme.com`

## Interpreting this
- Treat the public-domain state as unresolved because the two browser-visible checks disagree.
- Do not claim stable public uptime or stable public outage based on one snapshot alone.
- The most honest current statement is that browser-visible availability has been inconsistent across audit moments or network vantage points.

## Routing config drift identified (batch 8)
The latest browser-visible audit revealed that several domains were being routed to the wrong vertical content due to missing or misconfigured routing entries:
- `headyos.com`, `headyconnection.com`, `headyfinance.com`, `headyex.com` were all serving HeadyMe content instead of their own vertical content — caused by missing entries in `domain-router.js`, `ui-registry.js`, and `domain-registry.js`.
- `admin.headysystems.com` was rendering with HeadyEx navigation — caused by its absence from all routing surfaces plus the headysystems config_path pointing at `headyme/config.json`.
- `headyconnection` had its canonical/alias direction inverted (`.com` was canonical, `.org` was alias) — corrected to match browser evidence showing `.org` has unique content.

All six issues were fixed in batch 8. The domains now resolve to their correct projections across all four routing layers. See `CHANGES.md` batch 8 and `tests/routing-docs-auth-pass.test.js` for details.

## What to do next
- Re-run browser-visible checks from at least one additional network vantage.
- Compare Cloudflare edge behavior with direct origin checks and deployment logs.
- Record timestamps and outputs for each verification pass before updating any public-health claim.
- Do not fabricate content, SEO, or accessibility validation beyond what was actually observed in a successful browser-visible load.
