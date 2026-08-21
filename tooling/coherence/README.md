<!-- HEADY_BRAND:BEGIN
╔══════════════════════════════════════════════════════════════════╗
║  HEADY™ Coherence Kernel                                          ║
║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
╚══════════════════════════════════════════════════════════════════╝
HEADY_BRAND:END -->

# Coherence Kernel

The build-time realization of `heady-knowledge-cartographer`: derives a **System Map** of the whole OS
from ground-truth artifacts, gates on **contradiction** (not incompleteness), and computes the
**blast radius** of any change. Design: [`docs/LIQUID_LATENT_OS_COHERENCE.md`](../../docs/LIQUID_LATENT_OS_COHERENCE.md).

```bash
node src/coherence.mjs map          # derive .data/coherence/system-map.json
node src/coherence.mjs check        # contradiction-tiered gate (exit 2 on error-tier)
node src/coherence.mjs check --no-write  # read-only gate for previews and handoffs
node src/coherence.mjs ripple <id>  # blast radius — e.g. `ripple embedding.dim` or `ripple pkg:@heady/db`
node src/coherence.mjs all          # map + check (the CI/pre-push gate)
```

**Principles (non-negotiable):**
1. **Derive, never author.** Edges come only from `package.json`, `facts.yaml`, skill frontmatter, the
   ADR index, the decomposition manifest, `repos-manifest`. No hand-written metadata.
2. **Gate on contradiction, not incompleteness.** `error` = two sources of truth disagree (blocks).
   `info` = declared-but-unbuilt (never blocks) — safe on a pre-launch tree with 24 unbuilt packages.
3. **Federate, don't reimplement.** Invokes `data-consistency` as a content sub-gate; consumes
   `skill-registry` and the embed-corpus Merkle index. One index over the existing tools.

Outputs: `.data/coherence/{system-map,coherence-report,ripple}.json`.
