// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ headyfinance — trailing drawdown tracker                   ║
// ║  Faithful port of the Apex trailing-drawdown rule from the          ║
// ║  heady-trading-compliance spec — CORRECTING the legacy bug in       ║
// ║  src/trading/apex-risk-agent.js, which trailed on live equity and   ║
// ║  had no lock. The spec (authoritative) says:                        ║
// ║    • trail UP on highest *realized balance* (NOT equity),           ║
// ║    • the level LOCKS once it reaches the starting balance,          ║
// ║    • BREACH when real-time *equity (balance + unrealized P&L)*      ║
// ║      touches the level.                                             ║
// ║  Pure + deterministic. © 2026 HeadySystems Inc. — Eric Haywood     ║
// ╚══════════════════════════════════════════════════════════════════╝

/**
 * Create a trailing-drawdown tracker.
 * @param {{startingBalance:number, maxDrawdown:number}} cfg
 */
export function createDrawdownTracker({ startingBalance, maxDrawdown }) {
  if (!(Number.isFinite(startingBalance) && startingBalance > 0)) throw new Error("startingBalance must be positive");
  if (!(Number.isFinite(maxDrawdown) && maxDrawdown > 0)) throw new Error("maxDrawdown must be positive");

  let highestBalance = startingBalance;
  let level = startingBalance - maxDrawdown;
  let locked = false;

  return {
    /**
     * Update on every tick. @param {number} currentBalance realized balance.
     * @param {number} [unrealizedPnl] open P&L. @returns verdict incl. breach + cushion.
     */
    update(currentBalance, unrealizedPnl = 0) {
      if (!Number.isFinite(currentBalance)) throw new TypeError("currentBalance must be a finite number");
      if (!Number.isFinite(unrealizedPnl)) throw new TypeError("unrealizedPnl must be a finite number");
      const equity = currentBalance + unrealizedPnl;

      // Trail UP on highest REALIZED balance only (the corrected basis).
      if (currentBalance > highestBalance) {
        highestBalance = currentBalance;
        const next = highestBalance - maxDrawdown;
        if (next >= startingBalance) {
          level = startingBalance; // locks at starting balance and stops trailing
          locked = true;
        } else if (!locked) {
          level = next;
        }
      }

      const breached = equity <= level;
      return { breached, equity, level, cushion: equity - level, highestBalance, locked };
    },
    snapshot() { return { highestBalance, level, locked }; },
  };
}
