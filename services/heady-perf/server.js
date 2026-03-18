/*
 * © 2026 Heady™ Systems Inc.
 * HeadyPerf — φ-Scaled Performance Budgets
 * Enforces golden-ratio performance thresholds: p50 ≤ φ²ms, p99 ≤ φ⁵ms.
 */
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const PHI = 1.618033988749895;
const STORE_PATH = path.join(__dirname, '../../.heady_cache/perf-store.json');

const PHI_BUDGETS = {
  p50: Math.pow(PHI, 2) * 10,   //  ~26.2ms
  p90: Math.pow(PHI, 3) * 10,   //  ~42.4ms
  p95: Math.pow(PHI, 4) * 10,   //  ~68.5ms
  p99: Math.pow(PHI, 5) * 10,   // ~110.9ms
  ttfb: Math.pow(PHI, 3) * 10,
  fcp: Math.pow(PHI, 4) * 10,
  lcp: Math.pow(PHI, 5) * 10,
  cls: 1 / (PHI * PHI),           // ~0.382
  fid: Math.pow(PHI, 3) * 5
};

function loadStore() {
  try { return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')); }
  catch { return { measurements: [], version: 1 }; }
}
function saveStore(store) {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

function evaluate(metrics) {
  const results = {};
  for (const [key, value] of Object.entries(metrics)) {
    if (PHI_BUDGETS[key]) {
      const budget = PHI_BUDGETS[key];
      results[key] = { value, budget: budget.toFixed(1), pass: value <= budget, ratio: (value / budget).toFixed(2) };
    }
  }
  const passed = Object.values(results).filter(r => r.pass).length;
  return {
    metrics: results, passed, total: Object.keys(results).length,
    score: (passed / Math.max(1, Object.keys(results).length) * 100).toFixed(0) + '%',
    verdict: passed === Object.keys(results).length ? '✅ All budgets met' : '⚠️ Some budgets exceeded'
  };
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (parsed.pathname === '/health') return res.end(JSON.stringify({ status: 'ok', service: 'heady-perf' }));
  if (parsed.pathname === '/budgets') return res.end(JSON.stringify(PHI_BUDGETS, null, 2));
  if (parsed.pathname === '/evaluate' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const metrics = JSON.parse(body);
      const store = loadStore();
      const result = evaluate(metrics);
      store.measurements.push({ ...result, timestamp: new Date().toISOString() });
      store.version++;
      saveStore(store);
      res.end(JSON.stringify(result, null, 2));
    });
    return;
  }
  res.end(JSON.stringify({ service: 'HeadyPerf', version: '1.0.0', endpoints: { '/budgets': 'GET', '/evaluate': 'POST' } }));
});
const PORT = process.env.PORT || 8112;
server.listen(PORT, () => console.log(`⚡ HeadyPerf on :${PORT}`));
module.exports = { evaluate, PHI_BUDGETS };
