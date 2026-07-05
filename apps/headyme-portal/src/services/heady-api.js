// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Portal API client v2.0.0                                  ║
// ║  api        → rebuild codeflow  (VITE_CODEFLOW_API)               ║
// ║  legacyApi  → legacy advisor    (VITE_LEGACY_API)                 ║
// ║  lens       → HeadyLens stream  (VITE_HEADYLENS_API)              ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝
async function _call(base, method, path, body, token) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `${res.status} ${res.statusText}`);
  return data;
}

// ── rebuild codeflow API ───────────────────────────────────────────
const CODEFLOW_BASE = import.meta.env.VITE_CODEFLOW_API ?? '';

function cf(method, path, body, token) {
  return _call(CODEFLOW_BASE, method, path, body, token);
}

export const api = {
  status:        ()              => cf('GET',  '/api/status'),
  files:         (path, token)   => cf('GET',  `/api/files?path=${encodeURIComponent(path || '.')}`, null, token),
  assign:        (task, token)   => cf('GET',  `/api/assign?task=${encodeURIComponent(task)}`, null, token),
  listProposals: ()              => cf('GET',  '/codeflow/proposals'),
  submit:        (p, token)      => cf('POST', '/codeflow/proposals', p, token),
  evaluate:      (id, token)     => cf('POST', `/codeflow/proposals/${id}/evaluate`, {}, token),
  approve:       (id, b, token)  => cf('POST', `/codeflow/proposals/${id}/approve`, b, token),
  apply:         (id, token)     => cf('POST', `/codeflow/proposals/${id}/apply`, {}, token),
  rollback:      (id, token)     => cf('POST', `/codeflow/proposals/${id}/rollback`, {}, token),
};

// ── HeadyService dispatcher API ────────────────────────────────────
// registerServiceRoutes (src/hc_service_dispatcher.js) mounts on the
// heady-manager app — the same base as the codeflow API. No host is
// hardcoded: base comes from VITE_CODEFLOW_API.
export const services = {
  /** GET /api/service/catalog → { ok, services:[{name,endpoint,method,capabilities,component}] } */
  catalog:  (token)       => cf('GET',  '/api/service/catalog', null, token),
  /** GET /api/service/health → { ok, status, totalServices, recentSuccessRate, avgLatencyMs, ts } */
  health:   (token)       => cf('GET',  '/api/service/health',  null, token),
  /** POST /api/service/resolve { intent?|service? } → { ok, resolved, confidence, endpoint, method, capabilities } */
  resolve:  (body, token) => cf('POST', '/api/service/resolve', body, token),
  /** POST /api/service { intent?, service?, params? } → { ok, service, confidence, result } */
  dispatch: (body, token) => cf('POST', '/api/service',         body, token),
};

// ── Origin event fabric (SSE, GET /api/events on heady-manager) ────
// Same base as the codeflow/service APIs (VITE_CODEFLOW_API — no host
// hardcoded). The endpoint is unauthenticated-read like /health, but we
// stream via fetch + ReadableStream (the proven lens.stream parser) so
// reconnects carry replay position as ?lastEventId= — a plain query
// param, no preflight-triggering header, and one code path with lens.
export const events = {
  streamUrl: (lastEventId) => {
    const qs = lastEventId != null ? `?lastEventId=${encodeURIComponent(lastEventId)}` : '';
    return `${CODEFLOW_BASE}/api/events${qs}`;
  },
  /**
   * Open the origin SSE stream. `onEvent` fires per parsed event
   * ({id, ts, type, payload}); `type` is the bus subject (e.g.
   * heady.system.service.health). The hello bootstrap frame
   * (heady.system.stream.hello) arrives through `onEvent` too.
   * @param {(evt: {id:number|null, ts:string, type:string, payload:object}) => void} onEvent
   * @param {{ signal?: AbortSignal, lastEventId?: number, onOpen?: () => void, onClose?: (err?: Error) => void }} [opts]
   * @returns {{ close: () => void, lastEventId: () => number|null }}
   */
  stream(onEvent, { signal, lastEventId = null, onOpen, onClose } = {}) {
    const ctrl = new AbortController();
    if (signal) signal.addEventListener('abort', () => ctrl.abort(), { once: true });
    let lastId = lastEventId;
    (async () => {
      try {
        const res = await fetch(this.streamUrl(lastId), {
          headers: { accept: 'text/event-stream' },
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) throw new Error(`events stream ${res.status} ${res.statusText}`);
        onOpen?.();
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
            if (frame.startsWith(':')) continue; // φ⁷ keep-alive comment
            const idMatch = frame.match(/^id:\s*(\d+)$/m);
            if (idMatch) lastId = Number(idMatch[1]);
            const dataMatch = frame.match(/^data:\s*([\s\S]+)$/m);
            if (!dataMatch) continue;
            let parsed;
            try { parsed = JSON.parse(dataMatch[1]); } catch { continue; }
            onEvent?.(parsed);
          }
        }
        // Server closed the stream (deploy/shutdown) — surface it honestly.
        if (!ctrl.signal.aborted) onClose?.();
      } catch (err) {
        if (!ctrl.signal.aborted) onClose?.(err);
      }
    })();
    return { close: () => ctrl.abort(), lastEventId: () => lastId };
  },
};

// ── legacy advisor API ─────────────────────────────────────────────
const LEGACY_BASE = import.meta.env.VITE_LEGACY_API ?? '';

// ── HeadyLens API ──────────────────────────────────────────────────
const LENS_BASE = import.meta.env.VITE_HEADYLENS_API ?? '';

function la(method, path, body, token) {
  return _call(LEGACY_BASE, method, path, body, token);
}

export const legacyApi = {
  /** GET /api/advisor/health — uptime, lastAutoCommit, service count */
  health:      (token)           => la('GET', '/api/advisor/health',                   null, token),
  /** GET /api/advisor/swarm-status — active/total swarms, bee counts */
  swarmStatus: (token)           => la('GET', '/api/advisor/swarm-status',             null, token),
  /** GET /api/advisor/baseline — metric comparison array */
  baseline:    (token)           => la('GET', '/api/advisor/baseline',                  null, token),
  /** GET /api/advisor/patterns/:domain — auth|routing|vector|csl|swarm|pipeline */
  patterns:    (domain, token)   => la('GET', `/api/advisor/patterns/${domain}`,        null, token),
  /** GET /api/advisor/config/:service — service config advisor */
  config:      (service, token)  => la('GET', `/api/advisor/config/${service}`,         null, token),
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
  health: (token) => _call(LENS_BASE, 'GET', '/api/lens/health', null, token).catch(async () => {
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

