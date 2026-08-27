#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ headyfinance — paper-sim demo (run: npm run sim)          ║
// ║  A runnable, no-money, no-broker demonstration of the advisory     ║
// ║  brain: feeds a scripted tick series through the risk engine and   ║
// ║  prints the per-tick signal + the first breach. Structured JSON.   ║
// ║  Made with ❤️ by HeadySystems Inc.                                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import { createRiskEngine } from "../src/risk-engine.mjs";
import { runPaperSession } from "../src/paper-sim.mjs";

const out = (o) => process.stdout.write(`${JSON.stringify(o)}\n`);

const engine = createRiskEngine({ account: "50K", onEvent: (e) => out({ event: e.type, ...e }) });
const ticks = [
  { balance: 50000, openPnL: 0 },
  { balance: 50000, openPnL: -730 }, // caution: approaching MAE
  { balance: 50800, openPnL: 0 },    // realized gain → level trails
  { balance: 51000, openPnL: 0 },
  { balance: 49000, openPnL: -600 }, // equity 48400 → breach vs level 48500
];
const session = runPaperSession({ engine, ticks });
out({
  demo: "headyfinance paper-sim",
  ticks: session.ticks,
  breached: session.breached,
  firstBreachAt: session.firstBreachAt,
  signalCounts: session.signalCounts,
  perTick: session.records.map((r) => ({ i: r.i, signal: r.signal, equity: r.equity, cushion: +r.cushion.toFixed(2) })),
});
