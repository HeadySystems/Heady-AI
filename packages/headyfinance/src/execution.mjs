// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ headyfinance — execution adapter (paper broker)           ║
// ║  Leg 2, the live path — PAPER first. Defines the broker-agnostic    ║
// ║  ExecutionAdapter contract and a PaperBroker that implements it     ║
// ║  with correct position/avg-price/realized-P&L accounting and NO     ║
// ║  network, NO subscription, NO real money. A live Apex/Tradovate     ║
// ║  adapter is a FUTURE implementation of this SAME contract (it does  ║
// ║  not exist yet — real money is triple-gated: account + paper-proven ║
// ║  + explicit founder go). Made with ❤️ by HeadySystems Inc.         ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// ExecutionAdapter contract (what a live adapter must also implement):
//   submitMarket({ side:'buy'|'sell', qty:number, price:number }) → fill
//   flatten(price) → fill|null           position() → { position, avgPrice }
//   markToMarket(price) → unrealized     realized() → number   mode → string

/** A paper broker: deterministic fills at the given price, real P&L accounting. */
export function createPaperBroker() {
  let position = 0;      // signed units (+long / -short)
  let avgPrice = 0;      // average entry of the open position
  let realizedPnL = 0;
  const fills = [];

  function submitMarket({ side, qty, price }) {
    if (side !== "buy" && side !== "sell") throw new Error("side must be 'buy' or 'sell'");
    if (!(Number.isFinite(qty) && qty > 0)) throw new Error("qty must be a positive number");
    if (!(Number.isFinite(price) && price > 0)) throw new Error("price must be a positive number");
    const signed = side === "buy" ? qty : -qty;

    if (position === 0 || Math.sign(position) === Math.sign(signed)) {
      // Opening or adding — weighted average entry.
      const newPos = position + signed;
      avgPrice = (avgPrice * Math.abs(position) + price * Math.abs(signed)) / Math.abs(newPos);
      position = newPos;
    } else {
      // Reducing / closing / flipping — realize on the closed quantity.
      const closed = Math.min(Math.abs(signed), Math.abs(position));
      realizedPnL += closed * (price - avgPrice) * Math.sign(position);
      const newPos = position + signed;
      position = newPos;
      if (position === 0) avgPrice = 0;
      else if (Math.sign(newPos) !== Math.sign(position - signed)) avgPrice = price; // flipped
    }
    const fill = { side, qty, price, position, avgPrice: Math.round(avgPrice * 1e6) / 1e6 };
    fills.push(fill);
    return fill;
  }

  function flatten(price) {
    if (position === 0) return null;
    return submitMarket({ side: position > 0 ? "sell" : "buy", qty: Math.abs(position), price });
  }

  return {
    mode: "paper",
    submitMarket,
    flatten,
    position: () => ({ position, avgPrice }),
    markToMarket: (price) => position * (price - avgPrice),
    realized: () => Math.round(realizedPnL * 1e6) / 1e6,
    fills: () => fills.slice(),
  };
}
