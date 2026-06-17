// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Codeflow API v1.0.0                                       ║
// ║  Minimal dependency-free HTTP surface for the governed codeflow +  ║
// ║  a real /api/status (reads the actual coherence/registry/decomp    ║
// ║  artifacts — never fabricated). © 2026 HeadySystems — E. Haywood   ║
// ╚══════════════════════════════════════════════════════════════════╝
import { createServer } from 'node:http';
import { readFileSync, statSync, readdirSync } from 'node:fs';
import { join, resolve, normalize } from 'node:path';
import { FIB } from '../../phi-math/src/index.mjs';
import { Codeflow } from './engine.mjs';
import { verifyFirebaseToken } from './auth.mjs';
import { loadLinkIndex, ingressGuard, egressNormalize } from '../../consistency-bus/src/index.mjs';

const ROOT = resolve(new URL('../../..', import.meta.url).pathname);
const PORT = Number(process.env.PORT) || 8000 + FIB[13]; // Cloud Run injects PORT; local default 8233
const ORIGIN = process.env.CODEFLOW_ORIGIN || '*';
const TOKEN = process.env.CODEFLOW_TOKEN || ''; // optional service-to-service bearer (fail-closed when set)
const cf = new Codeflow({ root: ROOT });
// Consistency-bus middleware: recognize HeadyRegistry-linked values on every payload (best-effort —
// null when the registry hasn't been generated yet).
const LINK_INDEX = (() => { try { return loadLinkIndex({}); } catch { return null; } })();

// Resolve the caller to a VERIFIED principal — a Firebase ID token (preferred) or the service token.
// Returns null when no valid credential is presented (→ 401). Never trusts a client-sent identity.
async function principal(req) {
  const authz = req.headers.authorization || '';
  if (!authz.startsWith('Bearer ')) return TOKEN ? null : { email: 'anonymous:dev', service: true };
  const tok = authz.slice(7);
  if (TOKEN && tok === TOKEN) return { email: 'service:token', service: true };
  try { const v = await verifyFirebaseToken(tok); return { email: v.email || v.uid, service: false }; }
  catch { return null; }
}

// Read-only, path-safe codebase browser. Denies VCS/deps/derived/secret locations.
const DENY = /(^|\/)(\.git|node_modules|\.data|dist|\.turbo|\.env)/;
function browse(rel) {
  const norm = normalize(rel || '.');
  if (norm.startsWith('..') || DENY.test(norm)) throw new Error('path not browsable');
  const abs = join(ROOT, norm);
  if (!abs.startsWith(ROOT)) throw new Error('escapes repo');
  const st = statSync(abs);
  if (st.isDirectory()) {
    return { type: 'dir', path: norm, entries: readdirSync(abs, { withFileTypes: true }).filter((e) => !DENY.test(e.name)).map((e) => ({ name: e.name, type: e.isDirectory() ? 'dir' : 'file' })) };
  }
  if (st.size > FIB[16] * 1024) throw new Error('file too large');
  return { type: 'file', path: norm, content: readFileSync(abs, 'utf8') };
}
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

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://h');
    const path = url.pathname;
    const seg = path.split('/').filter(Boolean);
    if (req.method === 'OPTIONS') return send(res, 204, {});
    if (req.method === 'GET' && path === '/healthz') return send(res, 200, { ok: true });
    // egress: outbound system data is normalized to canonical linked values (never emit drift)
    if (req.method === 'GET' && path === '/api/status') return send(res, 200, LINK_INDEX ? egressNormalize(status(), LINK_INDEX).payload : status());
    if (req.method === 'GET' && path === '/codeflow/proposals') return send(res, 200, { proposals: cf.list() });
    if (req.method === 'GET' && seg[0] === 'codeflow' && seg[1] === 'proposals' && seg[2]) {
      return send(res, 200, { proposal: cf.get(seg[2]), history: cf.history(seg[2]) });
    }
    // codebase browser — read-only but reveals source → require a verified principal
    if (req.method === 'GET' && path === '/api/files') {
      if (!(await principal(req))) return send(res, 401, { error: 'unauthorized' });
      return send(res, 200, browse(url.searchParams.get('path') || '.'));
    }
    // mutations — verified principal drives the actor/approver identity (never client-claimed)
    if (req.method === 'POST') {
      const who = await principal(req);
      if (!who) return send(res, 401, { error: 'unauthorized' });
      const b = await body(req);
      // ingress: a payload that drifts a LOCKED HeadyRegistry value is refused fail-closed.
      // `content` is exempt — codeflow IS the governed channel for changing linked values.
      if (LINK_INDEX) {
        const authorizedKeys = (req.headers['x-heady-authorized-keys'] || '').split(',').map((s) => s.trim()).filter(Boolean);
        const { content, ...meta } = b;
        const guard = ingressGuard(meta, LINK_INDEX, { authorizedKeys });
        if (guard.verdict === 'BLOCK') return send(res, 409, { error: 'locked-value drift (consistency-bus)', blocked: guard.blocked });
      }
      if (path === '/codeflow/proposals') return send(res, 201, cf.submit({ ...b, actor: who.email }));
      if (seg[0] === 'codeflow' && seg[1] === 'proposals' && seg[2]) {
        const id = seg[2]; const action = seg[3];
        if (action === 'evaluate') return send(res, 200, cf.evaluate(id));
        if (action === 'approve') return send(res, 200, cf.approve(id, { approver: who.email, human: !who.service }));
        if (action === 'reject') return send(res, 200, cf.reject(id, { approver: who.email, reason: b.reason }));
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
