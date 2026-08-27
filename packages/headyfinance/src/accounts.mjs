// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ headyfinance — account risk tiers                          ║
// ║  The Apex Trader Funding tier table (authoritative source: the      ║
// ║  heady-trading-compliance skill's drawdown table). These are the    ║
// ║  DEFAULT presets; a personal account supplies its own custom        ║
// ║  { startingBalance, maxDrawdown, initialMAE } instead.              ║
// ║  ⚠ Apex changes its published rules over time — verify these        ║
// ║  against Apex's current official rules before any funded use.        ║
// ║  Made with ❤️ by HeadySystems Inc.                                 ║
// ╚══════════════════════════════════════════════════════════════════╝

/** Apex tier presets: balance, trailing max drawdown, initial MAE, safety-net buffer. */
export const APEX_TIERS = Object.freeze({
  "25K": { startingBalance: 25000, maxDrawdown: 1500, initialMAE: 450, safetyNetBuffer: 100 },
  "50K": { startingBalance: 50000, maxDrawdown: 2500, initialMAE: 750, safetyNetBuffer: 100 },
  "75K": { startingBalance: 75000, maxDrawdown: 2750, initialMAE: 825, safetyNetBuffer: 100 },
  "100K": { startingBalance: 100000, maxDrawdown: 3000, initialMAE: 900, safetyNetBuffer: 100 },
  "150K": { startingBalance: 150000, maxDrawdown: 5000, initialMAE: 1500, safetyNetBuffer: 100 },
  "250K": { startingBalance: 250000, maxDrawdown: 6500, initialMAE: 1950, safetyNetBuffer: 100 },
  "300K": { startingBalance: 300000, maxDrawdown: 7500, initialMAE: 2250, safetyNetBuffer: 100 },
});

/** Universal Apex evaluation/funded rules (prop-firm contract terms, not government regulation). */
export const APEX_RULES = Object.freeze({
  consistencyRule: 0.30, // no single day > 30% of total profit at payout
  maeRule: 0.30, // max open negative P&L = 30% of day-profit basis
  minTradingDaysBetweenPayouts: 8,
  minProfitableDays: 5,
  minProfitPerDay: 100,
  safetyNetPayouts: 3,
});

/**
 * Resolve an account config: a tier preset key, or a custom personal account.
 * @param {string|object} account tier key ("50K") OR { startingBalance, maxDrawdown, initialMAE?, safetyNetBuffer? }
 * @returns {{startingBalance:number, maxDrawdown:number, initialMAE:number, safetyNetBuffer:number}}
 */
export function resolveAccount(account = "50K") {
  if (typeof account === "string") {
    const preset = APEX_TIERS[account];
    if (!preset) throw new Error(`unknown Apex tier "${account}" (known: ${Object.keys(APEX_TIERS).join(", ")})`);
    return { ...preset };
  }
  if (!account || typeof account !== "object") throw new TypeError("account must be a tier key or a custom config object");
  const { startingBalance, maxDrawdown, initialMAE, safetyNetBuffer = 100 } = account;
  if (!(Number.isFinite(startingBalance) && startingBalance > 0)) throw new Error("custom account: startingBalance must be a positive number");
  if (!(Number.isFinite(maxDrawdown) && maxDrawdown > 0)) throw new Error("custom account: maxDrawdown must be a positive number");
  return {
    startingBalance,
    maxDrawdown,
    initialMAE: Number.isFinite(initialMAE) && initialMAE > 0 ? initialMAE : maxDrawdown * APEX_RULES.maeRule,
    safetyNetBuffer,
  };
}
