// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Portal API client v2.0.0                                  ║
// ║  api        → rebuild codeflow  (VITE_CODEFLOW_API)               ║
// ║  legacyApi  → legacy advisor    (VITE_LEGACY_API)                 ║
// ║  lens       → HeadyLens stream  (VITE_HEADYLENS_API)              ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
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

async function _stateCall(base, path, token) {
  const res = await fetch(`${base}${path}`, {
    headers: {
      accept: 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 503) throw new Error(data.error || `${res.status} ${res.statusText}`);
  return { ...data, httpStatus: res.status };
}

// ── shared SSE-over-fetch parser ───────────────────────────────────
// EventSource cannot send an Authorization header, so every stream in
// this client goes through fetch + ReadableStream. One parser, three
// consumers (events, lens, legacy advisor). Frames are split on \n\n;
// `:` keep-alive comments are dropped; onFrame receives
// { id: number|null, event: string|undefined, data: object } per frame
// whose data parses as JSON.
function _sseStream(url, { headers = {}, signal, onFrame, onOpen, onClose } = {}) {
  const ctrl = new AbortController();
  if (signal) signal.addEventListener('abort', () => ctrl.abort(), { once: true });
  (async () => {
    try {
      const res = await fetch(url, {
        headers: { accept: 'text/event-stream', ...headers },
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error(`stream ${res.status} ${res.statusText}`);
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
          if (frame.startsWith(':')) continue; // keep-alive comment
          const idMatch = frame.match(/^id:\s*(\d+)$/m);
          const evMatch = frame.match(/^event:\s*(.+)$/m);
          const dataMatch = frame.match(/^data:\s*([\s\S]+)$/m);
          if (!dataMatch) continue;
          let data;
          try { data = JSON.parse(dataMatch[1]); } catch { continue; }
          onFrame?.({ id: idMatch ? Number(idMatch[1]) : null, event: evMatch?.[1]?.trim(), data });
        }
      }
      // Server closed the stream (deploy/shutdown) — surface it honestly.
      if (!ctrl.signal.aborted) onClose?.();
    } catch (err) {
      if (!ctrl.signal.aborted) onClose?.(err);
    }
  })();
  return { close: () => ctrl.abort() };
}

// ── rebuild codeflow API ───────────────────────────────────────────
const CODEFLOW_BASE = import.meta.env.VITE_CODEFLOW_API ?? '';

function cf(method, path, body, token) {
  return _call(CODEFLOW_BASE, method, path, body, token);
}

export const api = {
  status:        (token)         => cf('GET',  '/api/status', null, token),
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
  stream(onEvent, { signal, lastEventId = null, token, onOpen, onClose } = {}) {
    let lastId = lastEventId;
    const handle = _sseStream(this.streamUrl(lastId), {
      signal,
      headers: token ? { authorization: `Bearer ${token}` } : {},
      onOpen,
      onClose,
      onFrame: ({ id, data }) => {
        if (id != null) lastId = id;
        onEvent?.(data);
      },
    });
    return { close: handle.close, lastEventId: () => lastId };
  },
};

// ── Console summary (§8 honeycomb data source, same origin as events) ──
export const consoleApi = {
  summary: (token) => _call(CODEFLOW_BASE, 'GET', '/api/console/summary', undefined, token),
};

// ── Nodes orchestration admin API ─────────────────────────────────
// Browser requests carry only a Firebase token. The portal gateway verifies
// the admin custom claim before injecting the internal service credential.
export const nodesApi = {
  registry:    (token)              => cf('GET', '/api/nodes', null, token),
  readiness:   (token)              => _stateCall(CODEFLOW_BASE, '/api/orchestration/readiness', token),
  maintenance: (token)              => _stateCall(CODEFLOW_BASE, '/api/maintenance/health', token),
  audit:       (token, { limit, node } = {}) => {
    const query = new URLSearchParams();
    if (limit != null) query.set('limit', String(limit));
    if (node) query.set('node', node);
    return cf('GET', `/api/nodes/audit?${query.toString()}`, null, token);
  },
  task: (taskId, token) => cf('GET', `/api/orchestration/tasks/${encodeURIComponent(taskId)}`, null, token),
  dispatch: (nodeId, body, token, { idempotencyKey, traceId }) => fetch(
    `${CODEFLOW_BASE}/api/nodes/${encodeURIComponent(nodeId)}/dispatch`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        'idempotency-key': idempotencyKey,
        'x-heady-trace-id': traceId,
      },
      body: JSON.stringify(body),
    },
  ).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `${res.status} ${res.statusText}`);
    return data;
  }),
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
  /**
   * GET /api/advisor/stream (SSE) — Bearer-authenticated live log stream.
   * `onLine` fires per structured log entry ({level, msg, ts, ...}).
   * @returns {{ close: () => void }}
   */
  stream(token, { signal, onLine, onOpen, onClose } = {}) {
    return _sseStream(`${LEGACY_BASE}/api/advisor/stream`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
      signal,
      onOpen,
      onClose,
      onFrame: ({ data }) => onLine?.(data),
    });
  },
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
    return _sseStream(this.streamUrl(subject, detail, sinceMs), {
      headers: token ? { authorization: `Bearer ${token}` } : {},
      onClose: (err) => { if (err) onError?.(err); },
      onFrame: ({ event, data }) => {
        if (event === 'ready') onReady?.(data);
        else onRecord?.(data);
      },
    });
  },
};
