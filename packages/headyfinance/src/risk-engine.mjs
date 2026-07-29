// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ headyfinance — risk + signal engine (paper-mode)          ║
// ║  The advisory brain: on each tick it evaluates the Apex/personal    ║
// ║  risk rules (corrected trailing drawdown, MAE, consistency) and     ║
// ║  emits a ternary signal {-1 repel · 0 hold · +1 engage}. It does    ║
// ║  NOT execute, route, or hold funds — it advises. Ported + corrected ║
// ║  from src/trading/apex-risk-agent.js; no console (an optional        ║
// ║  onEvent sink is injected). © 2026 HeadySystems Inc. — Eric Haywood║
// ╚══════════════════════════════════════════════════════════════════╝
import { resolveAccount, APEX_RULES } from "./accounts.mjs";
import { createDrawdownTracker } from "./drawdown.mjs";
import { riskGate, softGate } from "./gates.mjs";

/** Ternary signal states. */
export const SIGNAL = Object.freeze({ REPEL: -1, HOLD: 0, ENGAGE: +1 });

/**
 * Create a paper-mode risk/signal engine.
 * @param {object} [opts]
 * @param {string|object} [opts.account] tier key ("50K") or a custom personal account config
 * @param {(evt:{type:string}&object)=>void} [opts.onEvent] optional structured sink (no console)
 */
export function createRiskEngine({ account = "50K", onEvent = null } = {}) {
  const cfg = resolveAccount(account);
  const dd = createDrawdownTracker({ startingBalance: cfg.startingBalance, maxDrawdown: cfg.maxDrawdown });
  const emit = (evt) => { if (typeof onEvent === "function") onEvent(evt); };

  const state = {
    startOfDayBalance: cfg.startingBalance,
    currentBalance: cfg.startingBalance,
    openPnL: 0,
    dailyPnL: 0,
    tradingDays: 0,
    profitableDays: 0,
    totalProfit: 0,
    signals: [],
    violations: [],
  };

  /**
   * Evaluate risk on a tick. Advisory only.
   * @param {number} currentBalance realized balance
   * @param {number} [openPnL] open/unrealized P&L
   * @returns {{safe:boolean, violations:string[], signal:-1|0|1, detail:object}}
   */
  function checkRisk(currentBalance, openPnL = 0) {
    state.currentBalance = currentBalance;
    state.openPnL = openPnL;
    state.dailyPnL = currentBalance - state.startOfDayBalance;
    const violations = [];

    // 1. Trailing drawdown (corrected tracker: realized-balance trail, equity breach, locked at start).
    const draw = dd.update(currentBalance, openPnL);
    if (draw.breached) violations.push(`TRAILING_DRAWDOWN: equity ${draw.equity.toFixed(2)} <= level ${draw.level.toFixed(2)}`);

    // 2. MAE — open negative P&L vs the greater of initial MAE or 30% of day profit.
    const maeLimit = Math.max(cfg.initialMAE, Math.max(0, state.dailyPnL) * APEX_RULES.maeRule);
    if (openPnL < 0 && Math.abs(openPnL) > maeLimit) violations.push(`MAE_EXCEEDED: open ${openPnL.toFixed(2)} beyond -${maeLimit.toFixed(2)}`);

    // 3. Consistency — no single day > 30% of total profit.
    if (state.totalProfit > 0 && state.dailyPnL > 0) {
      const cap = state.totalProfit * APEX_RULES.consistencyRule;
      if (state.dailyPnL > cap) violations.push(`CONSISTENCY: day ${state.dailyPnL.toFixed(2)} > 30% of total ${cap.toFixed(2)}`);
    }

    // Signal: hard violation → REPEL; else CSL gates decide HOLD (approaching a limit) vs ENGAGE.
    let signal;
    if (violations.length > 0) {
      signal = SIGNAL.REPEL;
      emit({ type: "risk:violation", violations, equity: draw.equity, openPnL });
    } else {
      const rg = riskGate(openPnL, maeLimit);
      const drawdownProximity = (draw.highestBalance - draw.equity) / cfg.maxDrawdown;
      const drawdownActivation = softGate(drawdownProximity, 0.7, 15);
      if (rg.signal === -1 || drawdownActivation > 0.85) {
        signal = SIGNAL.HOLD;
        emit({ type: "risk:caution", drawdownActivation: +drawdownActivation.toFixed(4), riskProximity: +rg.proximity.toFixed(4), equity: draw.equity });
      } else {
        signal = SIGNAL.ENGAGE;
      }
    }

    const rec = { signal, equity: draw.equity, openPnL, cushion: draw.cushion };
    state.signals.push(rec);
    if (state.signals.length > 1000) state.signals = state.signals.slice(-500);
    if (violations.length) state.violations.push(...violations);

    return { safe: violations.length === 0, violations, signal, detail: { ...draw, maeLimit, dailyPnL: state.dailyPnL } };
  }

  /** Safety net = starting balance + trailing threshold + buffer (payout floor). */
  function safetyNet() { return cfg.startingBalance + cfg.maxDrawdown + cfg.safetyNetBuffer; }

  /** Payout eligibility (Apex funded rules). Advisory. */
  function canRequestPayout(amount) {
    if (!(Number.isFinite(amount) && amount > 0)) throw new Error("payout amount must be positive");
    const net = safetyNet();
    const balanceAfter = state.currentBalance - amount;
    const meetsDays = state.tradingDays >= APEX_RULES.minTradingDaysBetweenPayouts;
    const meetsProfitDays = state.profitableDays >= APEX_RULES.minProfitableDays;
    const aboveNet = balanceAfter >= net;
    return {
      allowed: meetsDays && meetsProfitDays && aboveNet,
      safetyNet: net, balanceAfter, tradingDays: state.tradingDays, profitableDays: state.profitableDays,
      reasons: [
        !meetsDays ? `need ${APEX_RULES.minTradingDaysBetweenPayouts} trading days, have ${state.tradingDays}` : null,
        !meetsProfitDays ? `need ${APEX_RULES.minProfitableDays} profitable days, have ${state.profitableDays}` : null,
        !aboveNet ? `balance after (${balanceAfter.toFixed(2)}) below safety net (${net.toFixed(2)})` : null,
      ].filter(Boolean),
    };
  }

  function startDay(balance) {
    state.startOfDayBalance = Number.isFinite(balance) ? balance : state.currentBalance;
    state.currentBalance = state.startOfDayBalance;
    state.openPnL = 0;
    state.dailyPnL = 0;
    emit({ type: "day:start", balance: state.startOfDayBalance });
  }

  function endDay() {
    const dayPnL = state.currentBalance - state.startOfDayBalance;
    state.tradingDays += 1;
    if (dayPnL >= APEX_RULES.minProfitPerDay) state.profitableDays += 1;
    state.totalProfit += Math.max(0, dayPnL);
    emit({ type: "day:end", dayPnL, totalProfit: state.totalProfit, tradingDays: state.tradingDays, profitableDays: state.profitableDays });
    return { dayPnL, totalProfit: state.totalProfit, tradingDays: state.tradingDays, profitableDays: state.profitableDays };
  }

  function status() {
    return {
      mode: "paper", // advisory only — never executes
      account: { ...cfg },
      drawdown: dd.snapshot(),
      safetyNet: safetyNet(),
      session: { ...state, signals: state.signals.slice(-10), violations: state.violations.slice(-10) },
    };
  }

  return { checkRisk, canRequestPayout, safetyNet, startDay, endDay, status, SIGNAL };
}
