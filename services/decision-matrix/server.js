/* © 2026 Heady™ Systems Inc. — Decision Matrix Engine (Multi-criteria with φ-weighted scoring) */
const http = require('http');
const url = require('url');
const PHI = 1.618033988749895;

function evaluateDecision(options, criteria) {
  const weighted = options.map(option => {
    let totalScore = 0;
    let totalWeight = 0;
    const scores = {};
    criteria.forEach((c, i) => {
      const weight = c.weight || Math.pow(1 / PHI, i); // φ-descending weights
      const score = option.scores?.[c.name] || 0.5;
      scores[c.name] = { score, weight: weight.toFixed(3), weighted: (score * weight).toFixed(3) };
      totalScore += score * weight;
      totalWeight += weight;
    });
    return { ...option, detailedScores: scores, totalScore: (totalScore / totalWeight).toFixed(3) };
  });
  return { ranked: weighted.sort((a, b) => b.totalScore - a.totalScore), criteria, phiWeighted: true };
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (parsed.pathname === '/health') return res.end(JSON.stringify({ status: 'ok', service: 'decision-matrix' }));
  if (parsed.pathname === '/evaluate' && req.method === 'POST') {
    let body = ''; req.on('data', c => body += c);
    req.on('end', () => { const { options, criteria } = JSON.parse(body); res.end(JSON.stringify(evaluateDecision(options || [], criteria || []), null, 2)); });
    return;
  }
  res.end(JSON.stringify({ service: 'Decision Matrix', version: '1.0.0', endpoints: { '/evaluate': 'POST {options, criteria}' } }));
});
const PORT = process.env.PORT || 8122;
server.listen(PORT, () => console.log(`⚖️ Decision Matrix on :${PORT}`));
module.exports = { evaluateDecision };
