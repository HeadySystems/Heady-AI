// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ headyfinance — CSL risk gates                              ║
// ║  Continuous (sigmoid) proximity gates over the locked @heady/csl-  ║
// ║  engine primitive, replacing the legacy src/core/semantic-logic    ║
// ║  soft_gate/risk_gate. A gate returns a smooth activation in [0,1]   ║
// ║  and a ternary signal {-1 repel · 0 hold · +1 engage}, so risk      ║
// ║  decisions degrade gracefully near a limit instead of snapping.     ║
// ║  Pure. © 2026 HeadySystems Inc. — Eric Haywood, Founder            ║
// ╚══════════════════════════════════════════════════════════════════╝
import { sigmoid } from "@heady/csl-engine";

/** Soft gate: sigmoid activation centred on `threshold` with `steepness`. Pure. */
export function softGate(score, threshold = 0.5, steepness = 20) {
  return sigmoid(steepness * (score - threshold));
}

/**
 * Risk gate over how close an open loss is to its MAE limit. Returns a smooth
 * activation and a caution signal: -1 when the loss is approaching the limit
 * (activation past the threshold), else 0. Never emits +1 — engaging is decided
 * by the engine only when NO gate is cautioning and no hard rule is violated.
 * @returns {{signal:-1|0, activation:number, proximity:number}}
 */
export function riskGate(openPnl, maeLimit, threshold = 0.8, steepness = 12) {
  const loss = Math.abs(Math.min(0, openPnl));
  const proximity = maeLimit > 0 ? loss / maeLimit : 0; // 0 = flat/positive, 1 = at the limit
  const activation = softGate(proximity, threshold, steepness);
  return { signal: activation > 0.85 ? -1 : 0, activation, proximity };
}
