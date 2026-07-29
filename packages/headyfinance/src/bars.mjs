// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ headyfinance — historical bar loader                      ║
// ║  Parses OHLC bars from CSV text (the free-data format from Stooq /  ║
// ║  Yahoo / most providers: Date,Open,High,Low,Close,Volume). Pure —   ║
// ║  no network, no subscription. Drop a downloaded CSV in and backtest.║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝

/**
 * Parse CSV text → chronological OHLC bars. Tolerates a header row and extra
 * columns; requires Date + Close at minimum. @returns {{date,open,high,low,close,volume}[]}
 */
export function parseCsvBars(text) {
  if (typeof text !== "string" || text.trim() === "") throw new TypeError("CSV text required");
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim() !== "");
  const header = lines[0].toLowerCase();
  const hasHeader = /date|close/.test(header);
  const rows = hasHeader ? lines.slice(1) : lines;
  const cols = hasHeader ? header.split(",").map((c) => c.trim()) : ["date", "open", "high", "low", "close", "volume"];
  const idx = (name) => cols.indexOf(name);
  const iDate = idx("date") >= 0 ? idx("date") : 0;
  const iOpen = idx("open"); const iHigh = idx("high"); const iLow = idx("low");
  const iClose = idx("close") >= 0 ? idx("close") : cols.length - 1;
  const iVol = idx("volume");

  const bars = [];
  for (const line of rows) {
    const f = line.split(",");
    const close = Number(f[iClose]);
    if (!Number.isFinite(close)) continue; // skip unparseable/blank rows
    bars.push({
      date: (f[iDate] ?? "").trim(),
      open: iOpen >= 0 ? Number(f[iOpen]) : close,
      high: iHigh >= 0 ? Number(f[iHigh]) : close,
      low: iLow >= 0 ? Number(f[iLow]) : close,
      close,
      volume: iVol >= 0 ? Number(f[iVol]) : 0,
    });
  }
  if (bars.length === 0) throw new Error("no parseable bars found in CSV");
  return bars;
}
