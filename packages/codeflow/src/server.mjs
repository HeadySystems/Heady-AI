// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Codeflow API v1.0.0                                       ║
// ║  Minimal dependency-free HTTP surface for the governed codeflow +  ║
// ║  a real /api/status (reads the actual coherence/registry/decomp    ║
// ║  artifacts — never fabricated). © 2026 HeadySystems — E. Haywood   ║
// ╚══════════════════════════════════════════════════════════════════╝
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { FIB } from '../../phi-math/src/index.mjs';
import { Codeflow } from './engine.mjs';

const ROOT = resolve(new URL('../../..', import.meta.url).pathname);
const PORT = Number(process.env.PORT) || 8000 + FIB[13]; // Cloud Run injects PORT; local default 8233
const ORIGIN = process.env.CODEFLOW_ORIGIN || '*';
const TOKEN = process.env.CODEFLOW_TOKEN || ''; // when set, POST routes require Bearer (fail-closed)
const cf = new Codeflow({ root: ROOT });
const log = (level, msg, f = {}) => process.stdout.write(`${JSON.stringify({ t: 'codeflow-api', level, msg, ...f })}\n`);

const readJson = (rel) => { try { return JSON.parse(readFileSync(join(ROOT, rel), 'utf8')); } catch { return null; } };

// Real system status — sourced from generated artifacts, with nulls (not fakes) when absent.
function status() {
  const coh = readJson('.data/coherence/coherence-report.json');
  const reg = readJson('.data/coherence/variable-registry.json');
  const dec = readJson('.data/decomposition/decomposition-report.json');
  const classes = {};
  for (const v of (reg?.vars || [])) classes[v.class] = (classes[v.class] || 0) + 1;
  return {
    generatedFrom: '.data/{coherence,decomposition} — run the kernels to refresh; null = not yet generated',
    coherence: coh ? { contradictions: coh.errors, incomplete: coh.info, gate: coh.errors ? 'BLOCKED' : 'GREEN' } : null,
    variables: reg ? { total: reg.count, classes } : null,
    decomposition: dec ? { groups: dec.groups_total, bundled: dec.bundled, components: dec.components_total } : null,
    codeflow: { proposals: cf.list().length },
  };
}

function send(res, code, body) {
  res.writeHead(code, {
    'content-type': 'application/json',
    'access-control-allow-origin': ORIGIN,
    'access-control-allow-headers': 'authorization,content-type',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
  });
  res.end(JSON.stringify(body));
}

const body = (req) => new Promise((ok) => { let d = ''; req.on('data', (c) => { d += c; }); req.on('end', () => { try { ok(d ? JSON.parse(d) : {}); } catch { ok({}); } }); });
const authed = (req) => !TOKEN || req.headers.authorization === `Bearer ${TOKEN}`;

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://h');
    const path = url.pathname;
    const seg = path.split('/').filter(Boolean);
    if (req.method === 'OPTIONS') return send(res, 204, {});
    if (req.method === 'GET' && path === '/healthz') return send(res, 200, { ok: true });
    if (req.method === 'GET' && path === '/api/status') return send(res, 200, status());
    if (req.method === 'GET' && path === '/codeflow/proposals') return send(res, 200, { proposals: cf.list() });
    if (req.method === 'GET' && seg[0] === 'codeflow' && seg[1] === 'proposals' && seg[2]) {
      return send(res, 200, { proposal: cf.get(seg[2]), history: cf.history(seg[2]) });
    }
    // mutations — gated
    if (req.method === 'POST') {
      if (!authed(req)) return send(res, 401, { error: 'unauthorized' });
      const b = await body(req);
      if (path === '/codeflow/proposals') return send(res, 201, cf.submit(b));
      if (seg[0] === 'codeflow' && seg[1] === 'proposals' && seg[2]) {
        const id = seg[2]; const action = seg[3];
        if (action === 'evaluate') return send(res, 200, cf.evaluate(id));
        if (action === 'approve') return send(res, 200, cf.approve(id, b));
        if (action === 'reject') return send(res, 200, cf.reject(id, b));
        if (action === 'apply') return send(res, 200, cf.apply(id));
        if (action === 'rollback') return send(res, 200, cf.rollback(id));
      }
    }
    return send(res, 404, { error: 'not found' });
  } catch (e) {
    return send(res, 400, { error: String(e.message) });
  }
});

// Start only when run directly (not when imported by a test).
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  server.listen(PORT, () => log('info', 'codeflow api listening', { port: PORT, authRequired: !!TOKEN }));
}

export { server, status };
