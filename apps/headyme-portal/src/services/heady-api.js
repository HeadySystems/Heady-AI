// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Portal API client v1.0.0                                  ║
// ║  Talks to @heady/codeflow (status + governed-codeflow endpoints).  ║
// ║  Base URL from env (VITE_CODEFLOW_API) — never hardcoded. Same-    ║
// ║  origin by default. © 2026 HeadySystems Inc. — Eric Haywood        ║
// ╚══════════════════════════════════════════════════════════════════╝
const BASE = import.meta.env.VITE_CODEFLOW_API ?? '';

async function call(method, path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `${res.status} ${res.statusText}`);
  return data;
}

export const api = {
  status: () => call('GET', '/api/status'),
  files: (path, token) => call('GET', `/api/files?path=${encodeURIComponent(path || '.')}`, null, token),
  assign: (task, token) => call('GET', `/api/assign?task=${encodeURIComponent(task)}`, null, token),
  listProposals: () => call('GET', '/codeflow/proposals'),
  submit: (p, token) => call('POST', '/codeflow/proposals', p, token),
  evaluate: (id, token) => call('POST', `/codeflow/proposals/${id}/evaluate`, {}, token),
  approve: (id, b, token) => call('POST', `/codeflow/proposals/${id}/approve`, b, token),
  apply: (id, token) => call('POST', `/codeflow/proposals/${id}/apply`, {}, token),
  rollback: (id, token) => call('POST', `/codeflow/proposals/${id}/rollback`, {}, token),
};
