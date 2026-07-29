// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ headyfinance — historical backtester (paper only)         ║
// ║  Runs an alpha strategy over historical OHLC bars, GATED by the     ║
// ║  risk engine (a drawdown/MAE breach forces flat), and reports        ║
// ║  honest metrics on the resulting equity curve. NO lookahead: the    ║
// ║  position decided at bar i earns the close[i]→close[i+1] move only. ║
// ║  This is a simulation of past data — it is NOT a prediction, a      ║
// ║  performance promise, or investment advice. © 2026 HeadySystems    ║
// ╚══════════════════════════════════════════════════════════════════╝
import { SIGNAL } from "./risk-engine.mjs";

const DISCLAIMER = "Historical paper simulation. Past performance does not indicate future results. Not investment advice.";

/**
 * Backtest a strategy over bars with risk gating. Pure given its inputs.
 * @param {object} args
 * @param {Array<{close:number}>} args.bars   OHLC bars (chronological)
 * @param {Array<{position:-1|0|1}|null>} args.signals  per-bar signals (aligned to bars)
 * @param {object} args.engine  a createRiskEngine() instance (the risk gate)
 * @param {number} [args.unitsPerSignal] position size in units (P&L = units × price move)
 * @returns {object} metrics + equity curve + disclaimer
 */
export function runBacktest({ bars, signals, engine, unitsPerSignal = 1 }) {
  if (!Array.isArray(bars) || bars.length < 2) throw new TypeError("bars must have at least 2 entries");
  if (!Array.isArray(signals) || signals.length !== bars.length) throw new TypeError("signals must align 1:1 with bars");
  if (!engine || typeof engine.checkRisk !== "function") throw new TypeError("engine (createRiskEngine) required");
  if (!(Number.isFinite(unitsPerSignal) && unitsPerSignal > 0)) throw new Error("unitsPerSignal must be positive");

  const closes = bars.map((b, i) => { if (!b || !Number.isFinite(b.close)) throw new TypeError(`bar[${i}].close invalid`); return b.close; });
  const startingEquity = engine.status().account.startingBalance;

  let balance = startingEquity;
  let position = 0;
  let entryEquity = null;
  let riskFlattenCount = 0;
  const trades = [];
  const equityCurve = [balance];
  let peak = balance;
  let maxDrawdownPct = 0;

  for (let i = 0; i < bars.length - 1; i += 1) {
    const sig = signals[i];
    let desired = sig && Number.isInteger(sig.position) ? sig.position : 0;

    // Risk gate: a breach on the current equity forces flat (respect the rules).
    const risk = engine.checkRisk(balance, 0);
    if (risk.signal === SIGNAL.REPEL) { desired = 0; riskFlattenCount += 1; }

    // Trade accounting on a position change (close the old trade, open the new).
    if (desired !== position) {
      if (position !== 0 && entryEquity != null) trades.push(balance - entryEquity);
      position = desired;
      entryEquity = position !== 0 ? balance : null;
    }

    // Realize this bar's move — no lookahead (decision at i, return i→i+1).
    balance += position * unitsPerSignal * (closes[i + 1] - closes[i]);
    equityCurve.push(balance);
    peak = Math.max(peak, balance);
    if (peak > 0) maxDrawdownPct = Math.max(maxDrawdownPct, (peak - balance) / peak);
  }
  if (position !== 0 && entryEquity != null) trades.push(balance - entryEquity);

  const wins = trades.filter((p) => p > 0);
  const losses = trades.filter((p) => p < 0);
  const round = (x) => Math.round(x * 100) / 100;

  return {
    mode: "paper-historical",
    startingEquity,
    finalEquity: round(balance),
    totalReturnPct: round(((balance - startingEquity) / startingEquity) * 100),
    barsTested: bars.length,
    trades: trades.length,
    winRatePct: trades.length ? round((wins.length / trades.length) * 100) : 0,
    avgWin: wins.length ? round(wins.reduce((a, b) => a + b, 0) / wins.length) : 0,
    avgLoss: losses.length ? round(losses.reduce((a, b) => a + b, 0) / losses.length) : 0,
    maxDrawdownPct: round(maxDrawdownPct * 100),
    riskFlattenCount,
    equityCurve: equityCurve.map(round),
    disclaimer: DISCLAIMER,
  };
}
