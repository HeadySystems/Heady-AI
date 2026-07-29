// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ headyfinance — paper-trading simulator                    ║
// ║  Runs the risk/signal engine over a series of simulated ticks with  ║
// ║  simulated money — a fully-functional, deterministic dry-run that    ║
// ║  needs NO broker, market-data feed, or real capital. This is how    ║
// ║  you test the brain before a cent is ever at risk. Pure (engine +   ║
// ║  ticks in → session report out). © 2026 HeadySystems Inc.          ║
// ╚══════════════════════════════════════════════════════════════════╝

/**
 * Run one paper session over a tick series. Each tick is
 * `{ balance, openPnL? }` (simulated realized balance + open P&L). The engine
 * advises a signal per tick; the sim records signals, the first breach, and
 * the closing state. Nothing executes — this is a simulation of the advisory.
 * @param {object} args
 * @param {object} args.engine a createRiskEngine() instance
 * @param {Array<{balance:number, openPnL?:number}>} args.ticks
 * @returns {{ticks:number, breached:boolean, firstBreachAt:number|null, signalCounts:object, records:object[], status:object}}
 */
export function runPaperSession({ engine, ticks }) {
  if (!engine || typeof engine.checkRisk !== "function") throw new TypeError("engine (createRiskEngine) required");
  if (!Array.isArray(ticks) || ticks.length === 0) throw new TypeError("ticks must be a non-empty array");

  const records = [];
  const signalCounts = { "-1": 0, "0": 0, "+1": 0 };
  let breached = false;
  let firstBreachAt = null;

  for (let i = 0; i < ticks.length; i += 1) {
    const t = ticks[i];
    if (!t || !Number.isFinite(t.balance)) throw new TypeError(`tick[${i}].balance must be a finite number`);
    const r = engine.checkRisk(t.balance, Number.isFinite(t.openPnL) ? t.openPnL : 0);
    signalCounts[String(r.signal === 1 ? "+1" : r.signal)] += 1;
    records.push({ i, signal: r.signal, safe: r.safe, equity: r.detail.equity, cushion: r.detail.cushion, violations: r.violations });
    if (!breached && !r.safe) { breached = true; firstBreachAt = i; }
  }

  return { ticks: ticks.length, breached, firstBreachAt, signalCounts, records, status: engine.status() };
}
