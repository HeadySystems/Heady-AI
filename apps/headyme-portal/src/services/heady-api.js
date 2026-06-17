// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Portal API client v1.1.0                                  ║
// ║  Talks to @heady/codeflow (status + governed-codeflow endpoints)   ║
// ║  and @heady/headylens (live build narrative SSE). Base URLs from   ║
// ║  env — never hardcoded; same-origin by default. HeadyLens is a     ║
// ║  SEPARATE service from codeflow (own host/port 8377).              ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝
const BASE = import.meta.env.VITE_CODEFLOW_API ?? '';
// HeadyLens runs on its own origin (default :8377). Falls back to same-origin so
// a reverse-proxied deploy that mounts both under one host still works.
const LENS_BASE = import.meta.env.VITE_HEADYLENS_API ?? '';

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

// ── HeadyLens: the live build narrative ──────────────────────────────
// The lens server is Bearer-auth + GET-only (no `*` CORS). EventSource cannot
// set an Authorization header, so we stream via fetch + ReadableStream and parse
// the SSE frames ourselves. `onRecord` fires per lens record; `onReady`/`onError`
// are lifecycle hooks. Returns an abort() handle.
export const lens = {
  // Subject prefix MUST match @heady/narrative NARRATIVE_PREFIX. detail=forensic
  // surfaces full payloads (build/step/summary/beat/…).
  streamUrl: (subject = 'heady.action.build.', detail = 'forensic', sinceMs) => {
    const qs = new URLSearchParams({ subject, detail });
    if (sinceMs != null) qs.set('since', String(sinceMs));
    return `${LENS_BASE}/api/lens/stream?${qs.toString()}`;
  },
  health: (token) => call('GET', '/api/lens/health', null, token).catch(async () => {
    const res = await fetch(`${LENS_BASE}/api/lens/health`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
    if (!res.ok) throw new Error(`lens ${res.status}`);
    return res.json();
  }),
  /**
   * Open the SSE narrative stream. Parses `event:`/`data:` frames from the body.
   * @returns {{ close: () => void }}
   */
  stream(token, { subject, detail, sinceMs, onRecord, onReady, onError } = {}) {
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch(this.streamUrl(subject, detail, sinceMs), {
          headers: { accept: 'text/event-stream', ...(token ? { authorization: `Bearer ${token}` } : {}) },
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) throw new Error(`lens stream ${res.status} ${res.statusText}`);
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let nl;
          while ((nl = buf.indexOf('\n\n')) !== -1) {
            const frame = buf.slice(0, nl);
            buf = buf.slice(nl + 2);
            if (frame.startsWith(':')) continue; // keep-alive comment
            const evMatch = frame.match(/^event:\s*(.+)$/m);
            const dataMatch = frame.match(/^data:\s*([\s\S]+)$/m);
            if (!dataMatch) continue;
            let parsed;
            try { parsed = JSON.parse(dataMatch[1]); } catch { continue; }
            if (evMatch && evMatch[1].trim() === 'ready') onReady?.(parsed);
            else onRecord?.(parsed);
          }
        }
      } catch (err) {
        if (!ctrl.signal.aborted) onError?.(err);
      }
    })();
    return { close: () => ctrl.abort() };
  },
};
