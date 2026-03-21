const { createLogger } = require('../utils/logger');
const logger = createLogger('auto-fixed');
/*
 * © 2026 Heady™ Systems Inc.
 * Golden Spiral UI Layout Engine
 * Arranges elements along actual golden spirals — most important at center,
 * decreasing priority radiating outward along the φ-curve.
 */

const {
  isAllowedOrigin
} = require('../../shared/cors-config');
const http = require('http');
const url = require('url');
const PHI = 1.618033988749895;
const TAU = Math.PI * 2;
function goldenSpiralLayout(elements, canvasWidth = 1200, canvasHeight = 800) {
  const cx = canvasWidth / 2,
    cy = canvasHeight / 2;
  const goldenAngle = TAU / (PHI * PHI); // ~137.5°

  return elements.map((el, i) => {
    const angle = i * goldenAngle;
    const r = Math.sqrt(i + 1) * 40;
    const scale = 1 / (1 + i * 0.1);
    return {
      ...el,
      index: i,
      x: Math.round(cx + r * Math.cos(angle)),
      y: Math.round(cy + r * Math.sin(angle)),
      scale: parseFloat(scale.toFixed(3)),
      priority: elements.length - i,
      width: Math.round(200 * scale),
      height: Math.round(120 * scale),
      opacity: Math.max(0.3, 1 - i * 0.05)
    };
  });
}
function fibonacciGrid(items, columns = 5) {
  const fib = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55];
  return items.map((item, i) => {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const fibWidth = fib[Math.min(col, fib.length - 1)];
    return {
      ...item,
      col,
      row,
      relativeWidth: fibWidth,
      gridArea: `${row + 1} / ${col + 1}`
    };
  });
}
const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  res.setHeader('Access-Control-Allow-Origin', isAllowedOrigin(req.headers.origin) ? req.headers.origin : 'null');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }
  if (parsed.pathname === '/health') return res.end(JSON.stringify({
    status: 'ok',
    service: 'golden-spiral-ui'
  }));
  if (parsed.pathname === '/layout' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const {
        elements,
        width,
        height
      } = JSON.parse(body);
      res.end(JSON.stringify(goldenSpiralLayout(elements || [], width, height)));
    });
    return;
  }
  if (parsed.pathname === '/grid' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const {
        items,
        columns
      } = JSON.parse(body);
      res.end(JSON.stringify(fibonacciGrid(items || [], columns)));
    });
    return;
  }
  if (parsed.pathname === '/demo') {
    const demo = goldenSpiralLayout(Array.from({
      length: 20
    }, (_, i) => ({
      id: i + 1,
      label: `Element ${i + 1}`,
      content: `Priority ${20 - i} item`
    })));
    return res.end(JSON.stringify(demo, null, 2));
  }
  res.end(JSON.stringify({
    service: 'Golden Spiral UI',
    version: '1.0.0',
    endpoints: {
      '/layout': 'POST',
      '/grid': 'POST',
      '/demo': 'GET'
    }
  }));
});
const PORT = process.env.PORT || 8107;
server.listen(PORT, () => logger.info(`🌀 Golden Spiral UI on :${PORT}`));
module.exports = {
  goldenSpiralLayout,
  fibonacciGrid
};