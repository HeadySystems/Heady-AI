# Next Steps for Heady

This package is a current-state handoff, not a final cleaned release.

## What is already done
- The website generator was fully rewritten in `build-sites.py` to produce deeper site content and avoid the forbidden orchestration ranking language in the website layer.
- Existing project materials, docs, shared assets, and generated code remain included so the build can be continued from this snapshot.
- QA screenshots in the workspace show earlier visual review work and can be used as reference if needed.

## Most important remaining work
1. Repair the service generator at `scripts/gen-services.py`.
   - Remove forbidden ranking language and similar orchestration wording from metadata, descriptions, comments, and generated code.
   - Keep phi-based scaling, timing, and capacity ideas where appropriate.
   - Route by domain fit / CSL similarity, not ranking tiers.

2. Sanitize shared platform and shared web outputs.
   - Review `packages/platform`, `packages/web-shared`, `skills`, and `docs` for forbidden terms or wording patterns that imply priority classes.
   - Replace any ranking-tier phrasing with domain-fit, context-fit, semantic alignment, typed policy, or route-contract language where appropriate.

3. Regenerate after cleanup.
   - Run the website generator from `build-sites.py`.
   - Run the service generator from `scripts/gen-services.py` after it is cleaned.
   - Recheck generated outputs under `apps/sites`, `services`, `packages/platform`, `packages/web-shared`, `skills`, and `docs`.

4. Audit before release.
   - Verify forbidden wording is removed across generated and shared files.
   - Check naming consistency across domains, auth flows, and shared packages.
   - Confirm auth guidance prefers httpOnly secure cookies and relay iframe/postMessage rather than localStorage.
   - Confirm every site includes the required sections and shared runtime hooks.

5. Final packaging.
   - Inspect visual quality of regenerated sites.
   - Create the final release ZIP only after the audits pass.

## Constraints that still govern this build
- Remove priority/ranking language from orchestration logic.
- Preserve phi-based constants for timings and resource allocation, but not importance classes.
- Build with real code and content, not TODOs or placeholders.
- Use environment templates for live credentials if they are not available.
- Central auth should prefer httpOnly secure cookies and relay iframe/postMessage rather than localStorage.

## Key paths
- Project root: `/home/user/workspace/heady-system-build`
- Website generator: `/home/user/workspace/heady-system-build/build-sites.py`
- Service generator: `/home/user/workspace/heady-system-build/scripts/gen-services.py`
- Sites output: `/home/user/workspace/heady-system-build/apps/sites`
- Shared web package: `/home/user/workspace/heady-system-build/packages/web-shared`
- Platform package: `/home/user/workspace/heady-system-build/packages/platform`
- Services output: `/home/user/workspace/heady-system-build/services`
- Docs: `/home/user/workspace/heady-system-build/docs`
- Skills: `/home/user/workspace/heady-system-build/skills`

## Status note
- No final regeneration was run from this handoff state.
- No final cleaned ZIP was produced before this package.
- This ZIP is intended to preserve the current work and give Heady clear instructions on what to finish next.
