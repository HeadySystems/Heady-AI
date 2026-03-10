# Heady™ φ-Math Foundation v4.0.0

**Author:** Eric Haywood / HeadySystems Inc. — 51 Provisional Patents
**Law:** ZERO magic numbers in any Heady module. All constants derive from φ or Fibonacci.

---

## Core Constants

| Symbol | Value | Formula |
|--------|-------|---------|
| φ (phi) | 1.618033988749895 | (1 + √5) / 2 |
| ψ (psi) | 0.6180339887498949 | 1 / φ |
| φ² | 2.618033988749895 | φ + 1 |
| φ³ | 4.236067977499790 | 2φ + 1 |
| φ⁴ | 6.854101966249685 | 3φ + 2 |
| φ⁵ | 11.090169943749474 | 5φ + 3 |

## Fibonacci Sequence (first 20)

```
F(0)=1, F(1)=1, F(2)=2, F(3)=3, F(4)=5, F(5)=8,
F(6)=13, F(7)=21, F(8)=34, F(9)=55, F(10)=89,
F(11)=144, F(12)=233, F(13)=377, F(14)=610, F(15)=987,
F(16)=1597, F(17)=2584, F(18)=4181, F(19)=6765
```

## CSL Thresholds

Computed as `phiThreshold(level) = 1 - ψ^level × 0.5`:

| Level | Name | Value | Use |
|-------|------|-------|-----|
| 0 | MINIMUM | 0.500 | Noise floor |
| 1 | LOW | 0.691 | Weak alignment |
| 2 | MEDIUM | 0.809 | Moderate alignment |
| 3 | HIGH | 0.882 | Strong alignment |
| 4 | CRITICAL | 0.927 | Near-certain |
| 6 | DEDUP | 0.972 | Semantic identity |

## Replacement Guide

| Old Magic Number | φ Replacement | Formula |
|-----------------|---------------|---------|
| 0.5 threshold | CSL_THRESHOLDS.MINIMUM | phiThreshold(0) |
| 0.7 threshold | CSL_THRESHOLDS.LOW | phiThreshold(1) |
| 0.8 threshold | CSL_THRESHOLDS.MEDIUM | phiThreshold(2) |
| 0.85 threshold | CSL_THRESHOLDS.HIGH | phiThreshold(3) |
| 0.95 threshold | CSL_THRESHOLDS.CRITICAL | phiThreshold(4) |
| 100 cache size | FIB[11] = 89 or FIB[12] = 144 | Fibonacci |
| 500 limit | FIB[14] = 377 or FIB[15] = 610 | Fibonacci |
| 1000 pool size | FIB[16] = 987 | Fibonacci |
| 60s timeout | FIB[10] = 55s | Fibonacci |
| 0.01 learning rate | ψ⁸ ≈ 0.0131 | PSI^8 |

## Pressure Levels

```
NOMINAL:   0     → ψ²   ≈ 0 – 0.382
ELEVATED:  ψ²    → ψ    ≈ 0.382 – 0.618
HIGH:      ψ     → 1-ψ³ ≈ 0.618 – 0.854
CRITICAL:  1-ψ⁴  → 1.0  ≈ 0.910 – 1.0
```

## Resource Allocation

```
Hot:        38.7% (phiFusionWeights(5)[0])
Warm:       23.9% (phiFusionWeights(5)[1])
Cold:       14.8% (phiFusionWeights(5)[2])
Reserve:     9.2% (phiFusionWeights(5)[3])
Governance:  5.7% (phiFusionWeights(5)[4])
```

## Usage in Code

```typescript
import { PHI, PSI, FIB, CSL_THRESHOLDS, phiBackoff, phiFusionWeights } from '@heady/shared/phi-math';

// Thresholds
if (similarity >= CSL_THRESHOLDS.HIGH) { /* strong match */ }

// Backoff
const delay = phiBackoff(attempt);

// Weights
const [w1, w2] = phiFusionWeights(2); // [0.618, 0.382]

// Sizes
const cacheSize = FIB[16]; // 987
const poolMax = FIB[7];     // 21
```

---

© 2026 Eric Haywood / HeadySystems Inc.
