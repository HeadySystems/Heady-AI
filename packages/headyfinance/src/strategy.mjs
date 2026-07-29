// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ headyfinance — alpha/strategy signals                     ║
// ║  Transparent, rule-based directional signals over historical bars: ║
// ║  {position: -1 short · 0 flat · +1 long, strength} per bar. This is ║
// ║  the ALPHA layer (what to trade); the risk engine is a SEPARATE     ║
// ║  gate (whether it's safe to). Signals are computed from data up to  ║
// ║  and including bar i only — NO lookahead. These are simple, honest  ║
// ║  strategies, not a promise of profit. © 2026 HeadySystems Inc.     ║
// ╚══════════════════════════════════════════════════════════════════╝
import { sma, rsi } from "./indicators.mjs";

/** Extract the close series from OHLC bars ({open,high,low,close}). */
function closesOf(bars) {
  if (!Array.isArray(bars) || bars.length === 0) throw new TypeError("bars must be a non-empty array");
  return bars.map((b, i) => {
    if (!b || !Number.isFinite(b.close)) throw new TypeError(`bar[${i}].close must be a finite number`);
    return b.close;
  });
}

/**
 * SMA crossover: long when fast SMA > slow SMA, short when below, flat until
 * both are defined. strength = normalized gap between the averages.
 * @returns {(({position:-1|0|1, strength:number})|null)[]} aligned to bars
 */
export function smaCrossover(bars, { fast = 10, slow = 30 } = {}) {
  if (fast >= slow) throw new Error("fast period must be < slow period");
  const closes = closesOf(bars);
  const f = sma(closes, fast); const s = sma(closes, slow);
  return closes.map((c, i) => {
    if (f[i] == null || s[i] == null) return null;
    const gap = (f[i] - s[i]) / s[i];
    return { position: gap > 0 ? 1 : gap < 0 ? -1 : 0, strength: Math.min(1, Math.abs(gap) * 20) };
  });
}

/**
 * RSI mean-reversion: long when oversold (RSI < lower), short when overbought
 * (RSI > upper), flat in between. strength = distance past the band.
 */
export function rsiReversion(bars, { period = 14, lower = 30, upper = 70 } = {}) {
  const closes = closesOf(bars);
  const r = rsi(closes, period);
  return closes.map((_, i) => {
    if (r[i] == null) return null;
    if (r[i] < lower) return { position: 1, strength: Math.min(1, (lower - r[i]) / lower) };
    if (r[i] > upper) return { position: -1, strength: Math.min(1, (r[i] - upper) / (100 - upper)) };
    return { position: 0, strength: 0 };
  });
}

/** The built-in strategy registry — name → factory(bars, params). */
export const STRATEGIES = Object.freeze({
  "sma-crossover": smaCrossover,
  "rsi-reversion": rsiReversion,
});

/** Resolve + run a strategy by name. @returns the per-bar signal array. */
export function runStrategy(name, bars, params = {}) {
  const fn = STRATEGIES[name];
  if (!fn) throw new Error(`unknown strategy "${name}" (known: ${Object.keys(STRATEGIES).join(", ")})`);
  return fn(bars, params);
}
