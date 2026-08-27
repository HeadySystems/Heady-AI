// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ headyfinance — live trading loop (paper)                  ║
// ║  Ties the three layers into one path: strategy signal → risk gate  ║
// ║  → execution adapter. This is the SAME loop a live run would use;   ║
// ║  swap the paper broker for a live Apex/Tradovate adapter (same      ║
// ║  contract) and it trades for real — which stays triple-gated. Here  ║
// ║  it drives a paper broker over historical/replayed bars: no         ║
// ║  network, no money. Made with ❤️ by HeadySystems Inc.              ║
// ╚══════════════════════════════════════════════════════════════════╝
import { SIGNAL } from "./risk-engine.mjs";

/**
 * Run the strategy→risk→execution loop over bars against an execution adapter.
 * Reconciles the broker's position to the risk-gated strategy target each bar,
 * marks to market, and feeds equity back to the risk engine. No lookahead.
 * @param {object} a
 * @param {Array<{close:number}>} a.bars
 * @param {Array<{position:-1|0|1}|null>} a.signals aligned to bars
 * @param {object} a.engine  createRiskEngine() (the risk gate)
 * @param {object} a.broker  an ExecutionAdapter (paper now, live later)
 * @param {number} [a.unitsPerSignal] target units per +1/-1 signal
 * @returns {object} session report (fills, equity, risk flattens, disclaimer)
 */
export function runLivePaper({ bars, signals, engine, broker, unitsPerSignal = 1 }) {
  if (!Array.isArray(bars) || bars.length < 2) throw new TypeError("bars must have at least 2 entries");
  if (!Array.isArray(signals) || signals.length !== bars.length) throw new TypeError("signals must align 1:1 with bars");
  if (!engine || typeof engine.checkRisk !== "function") throw new TypeError("engine required");
  if (!broker || typeof broker.submitMarket !== "function") throw new TypeError("broker (ExecutionAdapter) required");
  if (broker.mode !== "paper") throw new Error("runLivePaper refuses a non-paper broker — live execution is separately gated");

  const startingEquity = engine.status().account.startingBalance;
  let riskFlattenCount = 0;

  for (let i = 0; i < bars.length; i += 1) {
    const price = bars[i].close;
    if (!(Number.isFinite(price) && price > 0)) throw new TypeError(`bar[${i}].close must be a positive number`);

    const unrealized = broker.markToMarket(price);
    const equity = startingEquity + broker.realized() + unrealized;
    const risk = engine.checkRisk(equity, unrealized);

    // Target position = risk-gated strategy signal (breach → flat).
    const sig = signals[i];
    let target = sig && Number.isInteger(sig.position) ? sig.position * unitsPerSignal : 0;
    if (risk.signal === SIGNAL.REPEL) { target = 0; riskFlattenCount += 1; }

    // Reconcile broker position to target at this bar's price.
    const current = broker.position().position;
    const delta = target - current;
    if (delta !== 0) broker.submitMarket({ side: delta > 0 ? "buy" : "sell", qty: Math.abs(delta), price });
  }

  // Close out at the last price for a clean final equity.
  const lastPrice = bars[bars.length - 1].close;
  broker.flatten(lastPrice);
  const finalEquity = startingEquity + broker.realized();
  const round = (x) => Math.round(x * 100) / 100;

  return {
    mode: "paper",
    startingEquity,
    finalEquity: round(finalEquity),
    realizedPnL: round(broker.realized()),
    totalReturnPct: round(((finalEquity - startingEquity) / startingEquity) * 100),
    fills: broker.fills().length,
    riskFlattenCount,
    disclaimer: "Paper simulation over historical/replayed bars. Not live trading, not investment advice; past results do not indicate future performance.",
  };
}
