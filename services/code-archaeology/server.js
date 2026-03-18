/*
 * © 2026 Heady™ Systems Inc.
 * Code Archaeology MCP — Deep History of Code Evolution
 * Shows how any function/module evolved over time. Git-blame on steroids.
 */
const http = require('http');
const url = require('url');
const { execSync } = require('child_process');
const path = require('path');

function excavate(filePath, functionName) {
  try {
    const realPath = path.resolve(filePath);
    const log = execSync(`git log --oneline -20 -- "${realPath}" 2>/dev/null || echo "no git history"`, { encoding: 'utf8', cwd: path.dirname(realPath) }).trim();
    const entries = log.split('\n').filter(l => l && l !== 'no git history').map(l => {
      const [sha, ...rest] = l.split(' ');
      return { sha, message: rest.join(' ') };
    });
    return {
      file: filePath, function: functionName || null,
      commits: entries, totalChanges: entries.length,
      stability: entries.length <= 3 ? 'stable' : entries.length <= 10 ? 'moderate' : 'volatile',
      age: entries.length > 0 ? 'has history' : 'new file'
    };
  } catch (e) {
    return { file: filePath, error: e.message };
  }
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (parsed.pathname === '/health') return res.end(JSON.stringify({ status: 'ok', service: 'code-archaeology' }));
  if (parsed.pathname === '/excavate' && parsed.query.file) {
    return res.end(JSON.stringify(excavate(parsed.query.file, parsed.query.function), null, 2));
  }
  res.end(JSON.stringify({ service: 'Code Archaeology MCP', version: '1.0.0',
    endpoints: { '/excavate?file=&function=': 'GET' } }));
});
const PORT = process.env.PORT || 8114;
server.listen(PORT, () => console.log(`🏺 Code Archaeology on :${PORT}`));
module.exports = { excavate };
