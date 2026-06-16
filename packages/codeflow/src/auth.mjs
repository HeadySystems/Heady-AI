// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Firebase ID-token verification v1.0.0                     ║
// ║  Verifies Firebase RS256 ID tokens against Google's public x509    ║
// ║  certs — no Admin SDK. The VERIFIED identity (not a client claim)  ║
// ║  becomes the codeflow actor/approver. © 2026 HeadySystems          ║
// ╚══════════════════════════════════════════════════════════════════╝
import { createVerify } from 'node:crypto';

const CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const ISS_PREFIX = 'https://securetoken.google.com/';

const b64urlJson = (s) => JSON.parse(Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));

// Cache the certs per their Cache-Control max-age (Google rotates them).
let _cache = { certs: null, expiresAtMs: 0 };
async function fetchGoogleCerts() {
  if (_cache.certs && Date.now() < _cache.expiresAtMs) return _cache.certs;
  const res = await fetch(CERTS_URL);
  if (!res.ok) throw new Error(`cert fetch failed: ${res.status}`);
  const certs = await res.json();
  const maxAge = Number((res.headers.get('cache-control') || '').match(/max-age=(\d+)/)?.[1] || 0);
  _cache = { certs, expiresAtMs: Date.now() + maxAge * 1000 };
  return certs;
}

/**
 * Verify a Firebase ID token. Returns the decoded claims or throws.
 * `opts.projectId` is required (the audience). `opts.certResolver` is injectable for tests;
 * it maps a `kid` → PEM cert. `opts.now` overrides the clock (tests).
 */
export async function verifyFirebaseToken(token, opts = {}) {
  const projectId = opts.projectId || process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID not configured (fail-closed)');
  if (typeof token !== 'string' || token.split('.').length !== 3) throw new Error('malformed token');
  const [h, p, sig] = token.split('.');
  const header = b64urlJson(h);
  const claims = b64urlJson(p);
  if (header.alg !== 'RS256') throw new Error(`unexpected alg: ${header.alg}`);
  if (!header.kid) throw new Error('missing kid');

  const now = Math.floor((opts.now ?? Date.now()) / 1000);
  if (typeof claims.exp !== 'number' || claims.exp <= now) throw new Error('token expired');
  if (typeof claims.iat !== 'number' || claims.iat > now + 300) throw new Error('iat in the future');
  if (claims.aud !== projectId) throw new Error('aud mismatch');
  if (claims.iss !== `${ISS_PREFIX}${projectId}`) throw new Error('iss mismatch');
  if (!claims.sub || typeof claims.sub !== 'string') throw new Error('missing sub');

  const resolver = opts.certResolver || (async (kid) => (await fetchGoogleCerts())[kid]);
  const pem = await resolver(header.kid);
  if (!pem) throw new Error('signing cert not found for kid');

  const v = createVerify('RSA-SHA256');
  v.update(`${h}.${p}`);
  v.end();
  const ok = v.verify(pem, Buffer.from(sig.replace(/-/g, '+').replace(/_/g, '/'), 'base64'));
  if (!ok) throw new Error('signature verification failed');

  return { uid: claims.sub, email: claims.email || null, emailVerified: !!claims.email_verified, claims };
}
