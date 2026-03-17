# HEADY™ Maximum Potential Build Specification

## Unbreakable Laws
1. ALL constants derive from φ = 1.6180339887 — NO magic numbers
2. Node.js only — ESM exports (export default / export {})
3. SHA-256 for output hashing
4. Temperature = 0, seed = 42 for determinism
5. CSL gates replace ALL boolean if/else
6. No stubs, no TODOs, no placeholders — complete implementation
7. httpOnly cookies ONLY — NO localStorage for tokens
8. Concurrent-equals language — no priority/ranking
9. Eric Haywood is the founder (NOT "Eric Head")

## φ-Math Constants (canonical)
```javascript
const PHI = 1.6180339887498948;
const PSI = 1 / PHI;          // ≈ 0.6180339887
const PSI2 = PSI * PSI;       // ≈ 0.3819660113
const PSI3 = PSI * PSI * PSI; // ≈ 0.2360679775
const PHI2 = PHI + 1;         // ≈ 2.6180339887
const PHI3 = 2 * PHI + 1;     // ≈ 4.2360679775

const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765];

function phiThreshold(level, spread = 0.5) {
  return 1 - Math.pow(PSI, level) * spread;
}

const CSL_THRESHOLDS = {
  MINIMUM:  phiThreshold(0),  // ≈ 0.500
  LOW:      phiThreshold(1),  // ≈ 0.691
  MEDIUM:   phiThreshold(2),  // ≈ 0.809
  HIGH:     phiThreshold(3),  // ≈ 0.882
  CRITICAL: phiThreshold(4),  // ≈ 0.927
  DEDUP:    1 - Math.pow(PSI, 6) * 0.5, // ≈ 0.972
};
```

## Sacred Geometry Rings
- Central Hub: HeadySoul (origin)
- Inner Ring: HeadyBrains, HeadyConductor, HeadyVinci
- Middle Ring: JULES, BUILDER, OBSERVER, MURPHY, ATLAS, PYTHIA
- Outer Ring: BRIDGE, MUSE, SENTINEL, NOVA, JANITOR, SOPHIA, CIPHER, LENS
- Governance Shell: HeadyCheck, HeadyAssure, HeadyAware, HeadyPatterns, HeadyMC, HeadyRisk

## Resource Pools (Fibonacci allocation)
- Hot Pool: 34% (user-facing, latency-critical)
- Warm Pool: 21% (background processing)
- Cold Pool: 13% (batch, analytics)
- Reserve: 8% (burst capacity)
- Governance: 5% (quality + assurance)

## Platform Details
- GCP Project: gen-lang-client-0920560496
- Region: us-east1
- Cloudflare Account: 8b1fa38f282c691423c6399247d53323
- GitHub: https://github.com/HeadyMe
- Auth: Central auth at auth.headysystems.com
- 50 Services on ports 3310-3396
