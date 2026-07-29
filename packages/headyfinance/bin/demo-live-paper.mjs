#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ headyfinance — live-path paper demo (npm run live)        ║
// ║  Runs the full strategy→risk→execution loop against a PAPER broker ║
// ║  over a synthetic series. No broker account, no data feed, no      ║
// ║  money. Swap the paper broker for a live adapter (same contract)   ║
// ║  to trade for real — separately gated. © 2026 HeadySystems Inc.   ║
// ╚══════════════════════════════════════════════════════════════════╝
import { createRiskEngine } from "../src/risk-engine.mjs";
import { createPaperBroker } from "../src/execution.mjs";
import { runStrategy } from "../src/strategy.mjs";
import { runLivePaper } from "../src/live-loop.mjs";

const out = (o) => process.stdout.write(`${JSON.stringify(o)}\n`);

const bars = [];
for (let i = 0; i < 60; i += 1) {
  const trend = i < 25 ? i * 3 : i < 40 ? 75 - (i - 25) * 4 : 15 + (i - 40) * 2;
  bars.push({ close: 1000 + trend + Math.sin(i / 3) * 5 });
}
const signals = runStrategy("sma-crossover", bars, { fast: 5, slow: 20 });
const engine = createRiskEngine({ account: { startingBalance: 50000, maxDrawdown: 2500 } });
const broker = createPaperBroker();
const r = runLivePaper({ bars, signals, engine, broker, unitsPerSignal: 100 });

out({ demo: "headyfinance live-path (PAPER) — strategy→risk→execution", ...r });
