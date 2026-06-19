// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Studio — Gateway REST client                              ║
// ║  Talks to headymcp.com /api/studio/* with the Firebase bearer.     ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝
import { idToken } from './firebase.js';

const GATEWAY_URL = (import.meta.env.VITE_GATEWAY_URL ?? '').replace(/\/$/, '');
if (!GATEWAY_URL) throw new Error('VITE_GATEWAY_URL is required (no localhost fallback by policy)');

export const MCP_ENDPOINT = `${GATEWAY_URL}/mcp`;

async function authed(path, init = {}) {
  const token = await idToken();
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`gateway ${path} → ${res.status}`);
  return res.json();
}

/** Full catalog the UI renders from (models, modes, services, billing…). */
export const fetchManifest = () => authed('/api/studio/manifest');

/** Server-side billing estimate for a selection (authoritative meter). */
export const estimate = (selection) =>
  authed('/api/studio/estimate', { method: 'POST', body: JSON.stringify(selection) });

/** Liveness/wiring snapshot — surfaces whether persistent memory is bound. */
export const health = () => fetch(`${GATEWAY_URL}/health`).then((r) => r.json());
