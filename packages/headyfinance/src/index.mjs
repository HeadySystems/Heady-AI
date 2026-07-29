// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ headyfinance — public surface                             ║
// ║  Paper-mode risk + signal advisory. No execution, no custody.       ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝
export { createRiskEngine, SIGNAL } from "./risk-engine.mjs";
export { runPaperSession } from "./paper-sim.mjs";
export { createDrawdownTracker } from "./drawdown.mjs";
export { softGate, riskGate } from "./gates.mjs";
export { APEX_TIERS, APEX_RULES, resolveAccount } from "./accounts.mjs";

// ── Leg 1: alpha/strategy signals + historical backtest (paper only) ──
export { sma, ema, rsi } from "./indicators.mjs";
export { smaCrossover, rsiReversion, runStrategy, STRATEGIES } from "./strategy.mjs";
export { runBacktest } from "./backtest.mjs";
export { parseCsvBars } from "./bars.mjs";
