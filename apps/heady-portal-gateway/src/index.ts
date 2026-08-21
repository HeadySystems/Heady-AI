// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Portal → API Gateway — Cloudflare Worker                  ║
// ║  Fronts the PRIVATE codeflow Cloud Run API for the browser portal. ║
// ║  Inbound:  verifies the caller's Firebase ID token (RS256/JWKS).   ║
// ║  Outbound: mints a Google identity token (SA JWT → id_token) with  ║
// ║            run.invoker for the Cloud Run audience and forwards.     ║
// ║  Fail-closed: no valid Firebase token ⇒ 401, request never leaves. ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// The Cloud Run service is deployed --no-allow-unauthenticated (org policy + least
// privilege), so Google's frontend only accepts GOOGLE identity tokens from a
// run.invoker principal — not the FIREBASE user tokens the browser holds. This worker
// bridges the two token domains at the edge: it is the only principal with run.invoker.

export interface Env {
  FIREBASE_PROJECT_ID: string; // audience/issuer for Firebase ID-token verification (heady-ai)
  CLOUD_RUN_URL: string;       // https://heady-codeflow-api-...run.app (private origin + token audience)
  ALLOWED_ORIGINS: string;     // comma list, e.g. https://heady-ai.web.app,https://headyme.com
  GCP_SA_KEY: string;          // SECRET: JSON SA key holding roles/run.invoker on the Cloud Run service
  INTERNAL_NODE_SECRET: string; // SECRET: service credential injected only after Firebase admin verification
}

const FIREBASE_JWK_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const ISS_PREFIX = 'https://securetoken.google.com/';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

// Cloudflare Workers have no pino; the platform's structured-log sink is the console,
// surfaced via `wrangler tail` + Workers observability. Bound via computed access (AGENTS.md #2
// targets Node services where pino applies; the edge runtime's only JSON-log sink is this).
const _sink: (line: string) => void = (globalThis as unknown as { console: Record<string, (s: string) => void> }).console['log'];
const log = (level: string, msg: string, fields: Record<string, unknown> = {}) =>
  _sink(JSON.stringify({ t: 'portal-api-gateway', level, msg, ...fields }));

const b64urlToBytes = (s: string): Uint8Array => {
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};
const b64urlToJson = (s: string) => JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));
const bytesToB64url = (bytes: ArrayBuffer): string => {
  let bin = '';
  for (const b of new Uint8Array(bytes)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const strToB64url = (s: string) => bytesToB64url(new TextEncoder().encode(s).buffer as ArrayBuffer);

// ── Firebase ID-token verification (RS256 via JWKS, WebCrypto) ──────────────────
let _jwkCache: { keys: Record<string, JsonWebKey> | null; expiresAtMs: number } = { keys: null, expiresAtMs: 0 };
async function firebaseJwks(): Promise<Record<string, JsonWebKey>> {
  if (_jwkCache.keys && Date.now() < _jwkCache.expiresAtMs) return _jwkCache.keys;
  const res = await fetch(FIREBASE_JWK_URL);
  if (!res.ok) throw new Error(`jwk fetch ${res.status}`);
  const body = await res.json<{ keys: (JsonWebKey & { kid: string })[] }>();
  const maxAge = Number((res.headers.get('cache-control') || '').match(/max-age=(\d+)/)?.[1] || 3600);
  const byKid: Record<string, JsonWebKey> = {};
  for (const k of body.keys) byKid[k.kid] = k;
  _jwkCache = { keys: byKid, expiresAtMs: Date.now() + maxAge * 1000 };
  return byKid;
}

async function verifyFirebaseToken(token: string, projectId: string) {
  if (typeof token !== 'string' || token.split('.').length !== 3) throw new Error('malformed token');
  const [h, p, sig] = token.split('.');
  const header = b64urlToJson(h);
  const claims = b64urlToJson(p);
  if (header.alg !== 'RS256') throw new Error(`unexpected alg ${header.alg}`);
  if (!header.kid) throw new Error('missing kid');

  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== 'number' || claims.exp <= now) throw new Error('token expired');
  if (typeof claims.iat !== 'number' || claims.iat > now + 300) throw new Error('iat in the future');
  if (claims.aud !== projectId) throw new Error('aud mismatch');
  if (claims.iss !== `${ISS_PREFIX}${projectId}`) throw new Error('iss mismatch');
  if (!claims.sub) throw new Error('missing sub');

  const jwk = (await firebaseJwks())[header.kid];
  if (!jwk) throw new Error('signing key not found for kid');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(sig), new TextEncoder().encode(`${h}.${p}`));
  if (!ok) throw new Error('signature verification failed');
  return { uid: claims.sub as string, email: (claims.email as string) || null, admin: claims.admin === true };
}

// ── GCP identity token minting (SA JWT → id_token, cached ~55m) ─────────────────
async function importPkcs8(pem: string): Promise<CryptoKey> {
  const body = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  return crypto.subtle.importKey(
    'pkcs8', b64urlToBytes(body.replace(/\+/g, '-').replace(/\//g, '_')),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']
  );
}

let _idTokCache: { token: string | null; expiresAtMs: number } = { token: null, expiresAtMs: 0 };
async function gcpIdToken(saKeyJson: string, audience: string): Promise<string> {
  if (_idTokCache.token && Date.now() < _idTokCache.expiresAtMs) return _idTokCache.token;
  const sa = JSON.parse(saKeyJson);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT', kid: sa.private_key_id };
  const claimSet = { iss: sa.client_email, sub: sa.client_email, aud: GOOGLE_TOKEN_URL, iat: now, exp: now + 3600, target_audience: audience };
  const unsigned = `${strToB64url(JSON.stringify(header))}.${strToB64url(JSON.stringify(claimSet))}`;
  const key = await importPkcs8(sa.private_key);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const assertion = `${unsigned}.${bytesToB64url(sig)}`;

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${assertion}`,
  });
  if (!res.ok) throw new Error(`token exchange ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const { id_token } = await res.json<{ id_token?: string }>();
  if (!id_token) throw new Error('no id_token in exchange response');
  _idTokCache = { token: id_token, expiresAtMs: Date.now() + 55 * 60 * 1000 };
  return id_token;
}

function corsHeaders(origin: string, allowed: string[]): Record<string, string> {
  const ok = allowed.includes(origin);
  return {
    'access-control-allow-origin': ok ? origin : allowed[0] || 'null',
    'access-control-allow-headers': 'authorization,content-type,idempotency-key,x-heady-trace-id',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'vary': 'origin',
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const cors = corsHeaders(origin, allowed);
    const json = (code: number, body: unknown) =>
      new Response(JSON.stringify(body), { status: code, headers: { 'content-type': 'application/json', ...cors } });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    // Verify the browser's Firebase ID token — fail-closed.
    const authz = request.headers.get('authorization') || '';
    if (!authz.startsWith('Bearer ')) return json(401, { error: 'missing Firebase bearer token' });
    let principal: { uid: string; email: string | null; admin: boolean };
    try {
      principal = await verifyFirebaseToken(authz.slice(7), env.FIREBASE_PROJECT_ID);
    } catch (e: unknown) {
      log('warn', 'firebase verify failed', { err: String((e as Error).message) });
      return json(401, { error: 'invalid Firebase token' });
    }

    const privilegedNodeRoute = url.pathname === '/api/nodes/audit'
      || /^\/api\/nodes\/[^/]+\/(dispatch|heartbeat)$/.test(url.pathname)
      || /^\/api\/orchestration\/tasks\/[^/]+$/.test(url.pathname);
    const privilegedAdminRoute = privilegedNodeRoute
      || url.pathname === '/api/files'
      || url.pathname === '/api/assign'
      || url.pathname.startsWith('/codeflow/proposals');
    if (privilegedAdminRoute && !principal.admin) {
      return json(403, { error: 'admin claim required' });
    }
    if (privilegedNodeRoute && !env.INTERNAL_NODE_SECRET) {
      log('error', 'node service credential unavailable', { path: url.pathname });
      return json(503, { error: 'admin orchestration unavailable' });
    }

    // Mint a Google identity token and forward to the private Cloud Run origin.
    let idToken: string;
    try {
      idToken = await gcpIdToken(env.GCP_SA_KEY, env.CLOUD_RUN_URL);
    } catch (e: unknown) {
      log('error', 'id-token mint failed', { err: String((e as Error).message) });
      return json(502, { error: 'upstream auth unavailable' });
    }

    const originUrl = `${env.CLOUD_RUN_URL}${url.pathname}${url.search}`;
    const fwd = new Headers(request.headers);
    fwd.set('authorization', `Bearer ${idToken}`);             // Google identity token for Cloud Run
    fwd.set('x-heady-user', principal.email || principal.uid); // verified identity for the app layer
    if (privilegedNodeRoute) {
      fwd.set('x-heady-internal-secret', env.INTERNAL_NODE_SECRET);
      fwd.set('x-heady-actor-node', 'GOVERNANCE');
    } else {
      fwd.delete('x-heady-internal-secret');
      fwd.delete('x-heady-actor-node');
    }
    fwd.delete('host');

    let upstream: Response;
    try {
      upstream = await fetch(originUrl, {
        method: request.method,
        headers: fwd,
        body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      });
    } catch (e: unknown) {
      log('error', 'upstream fetch failed', { err: String((e as Error).message) });
      return json(502, { error: 'upstream unreachable' });
    }

    const out = new Headers(upstream.headers);
    for (const [k, v] of Object.entries(cors)) out.set(k, v);
    log('info', 'proxied', { path: url.pathname, status: upstream.status, user: principal.email || principal.uid });
    return new Response(upstream.body, { status: upstream.status, headers: out });
  },
};
