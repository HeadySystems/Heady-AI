#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ headyfinance — backtest demo (run: npm run backtest)      ║
// ║  Runs an SMA-crossover strategy over a synthetic historical series ║
// ║  through the risk-gated backtester and prints honest metrics.      ║
// ║  No broker, no data subscription, no real money. Structured JSON.  ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝
import { createRiskEngine } from "../src/risk-engine.mjs";
import { runStrategy } from "../src/strategy.mjs";
import { runBacktest } from "../src/backtest.mjs";

const out = (o) => process.stdout.write(`${JSON.stringify(o)}\n`);

// Synthetic "market": an uptrend, a drawdown, then recovery — a stand-in for a
// real CSV (drop your own via parseCsvBars for real historical data).
const bars = [];
for (let i = 0; i < 60; i += 1) {
  const trend = i < 25 ? i * 3 : i < 40 ? 75 - (i - 25) * 4 : 15 + (i - 40) * 2;
  bars.push({ close: 1000 + trend + Math.sin(i / 3) * 5 });
}

const signals = runStrategy("sma-crossover", bars, { fast: 5, slow: 20 });
const engine = createRiskEngine({ account: { startingBalance: 50000, maxDrawdown: 2500 } });
const result = runBacktest({ bars, signals, engine, unitsPerSignal: 100 });

out({
  demo: "headyfinance backtest — sma-crossover, risk-gated, paper",
  startingEquity: result.startingEquity,
  finalEquity: result.finalEquity,
  totalReturnPct: result.totalReturnPct,
  trades: result.trades,
  winRatePct: result.winRatePct,
  maxDrawdownPct: result.maxDrawdownPct,
  riskFlattenCount: result.riskFlattenCount,
  disclaimer: result.disclaimer,
});
