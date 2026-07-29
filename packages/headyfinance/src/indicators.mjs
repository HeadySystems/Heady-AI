// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ headyfinance — technical indicators                       ║
// ║  Standard, transparent, pure indicator math over a close series.   ║
// ║  Each returns an array aligned to the input (leading nulls until    ║
// ║  the lookback is satisfied) so a backtest can index by bar with no  ║
// ║  off-by-one. No magic: SMA, EMA (k=2/(n+1)), Wilder's RSI.         ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝

const nums = (a) => { if (!Array.isArray(a) || a.some((x) => !Number.isFinite(x))) throw new TypeError("series must be an array of finite numbers"); };

/** Simple moving average. @returns (number|null)[] aligned to closes. */
export function sma(closes, period) {
  nums(closes);
  if (!Number.isInteger(period) || period < 1) throw new Error("period must be a positive integer");
  const out = new Array(closes.length).fill(null);
  let sum = 0;
  for (let i = 0; i < closes.length; i += 1) {
    sum += closes[i];
    if (i >= period) sum -= closes[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/** Exponential moving average (k = 2/(period+1)); seeded with the first SMA. */
export function ema(closes, period) {
  nums(closes);
  if (!Number.isInteger(period) || period < 1) throw new Error("period must be a positive integer");
  const out = new Array(closes.length).fill(null);
  const k = 2 / (period + 1);
  let prev = null; let seed = 0;
  for (let i = 0; i < closes.length; i += 1) {
    if (i < period - 1) { seed += closes[i]; continue; }
    if (i === period - 1) { seed += closes[i]; prev = seed / period; out[i] = prev; continue; }
    prev = closes[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** Wilder's RSI over `period`. @returns (number|null)[] in [0,100]. */
export function rsi(closes, period = 14) {
  nums(closes);
  if (!Number.isInteger(period) || period < 1) throw new Error("period must be a positive integer");
  const out = new Array(closes.length).fill(null);
  let avgGain = 0; let avgLoss = 0;
  for (let i = 1; i < closes.length; i += 1) {
    const change = closes[i] - closes[i - 1];
    const gain = Math.max(0, change);
    const loss = Math.max(0, -change);
    if (i <= period) {
      avgGain += gain; avgLoss += loss;
      if (i === period) {
        avgGain /= period; avgLoss /= period;
        out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
      }
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }
  }
  return out;
}
