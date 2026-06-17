// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ <heady-build-narrative> v1.0.0                            ║
// ║  Vanilla Web Component: the build, as it happens. Subscribes to    ║
// ║  the HeadyLens SSE spine (/api/lens/stream) filtered to the        ║
// ║  narrative subject prefix (heady.action.build.) and renders each   ║
// ║  beat as a live, human-readable story thread (grouped by traceId). ║
// ║  ADR-0026 palette: #00d4aa teal=healthy · #7c5eff violet=degraded  ║
// ║  · amber=stalled. φ⁷ heartbeat (29034ms) reconnect cadence.        ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝
import { lens } from '../services/heady-api.js';

// Golden-ratio cadence (ADR-0026 golden heartbeat) — used for reconnect backoff.
const PHI7_MS = 29034;
const MAX_BEATS = 144; // FIB[12] — bound the DOM; oldest beats drop off.

// Beat → glyph + accent. Teal healthy / violet decision-or-degraded / amber waiting / red fail.
const BEAT_STYLE = {
  plan: { glyph: '◇', accent: '#7c5eff', label: 'PLAN' },
  start: { glyph: '▸', accent: '#00d4aa', label: 'START' },
  progress: { glyph: '·', accent: '#00d4aa', label: 'PROGRESS' },
  decision: { glyph: '◆', accent: '#7c5eff', label: 'DECISION' },
  gate: { glyph: '⛬', accent: '#7c5eff', label: 'GATE' },
  done: { glyph: '✓', accent: '#00d4aa', label: 'DONE' },
  blocked: { glyph: '⏸', accent: '#ffb020', label: 'BLOCKED' },
  fail: { glyph: '✕', accent: '#ff5470', label: 'FAIL' },
};
const FALLBACK_STYLE = { glyph: '•', accent: '#9aa', label: 'BEAT' };

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export class HeadyBuildNarrative extends HTMLElement {
  static get observedAttributes() { return ['subject', 'detail']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    /** @type {{close:()=>void}|null} */
    this._handle = null;
    this._token = null;
    this._beats = []; // most-recent-last
    this._status = 'idle';
    this._reconnects = 0;
    this._timer = null;
  }

  /** The portal injects the Firebase ID token getter so the component stays auth-agnostic. */
  set tokenProvider(fn) { this._tokenProvider = fn; }

  connectedCallback() {
    this._renderShell();
    this._open();
  }

  disconnectedCallback() {
    this._handle?.close();
    if (this._timer) clearTimeout(this._timer);
  }

  attributeChangedCallback() {
    if (this.isConnected) { this._handle?.close(); this._open(); }
  }

  async _open() {
    this._setStatus('connecting');
    let token = '';
    try { token = (await this._tokenProvider?.()) ?? ''; } catch { /* fail-open to anon; lens may 401 */ }
    const subject = this.getAttribute('subject') || undefined; // defaults to NARRATIVE_PREFIX in api client
    const detail = this.getAttribute('detail') || 'forensic';
    this._handle = lens.stream(token, {
      subject,
      detail,
      onReady: () => { this._setStatus('live'); this._reconnects = 0; },
      onRecord: (rec) => this._onRecord(rec),
      onError: (err) => this._onError(err),
    });
  }

  _onError(err) {
    this._setStatus('degraded', err?.message);
    // φ⁷-scaled reconnect: golden heartbeat × PHI^reconnects, capped.
    const delay = Math.min(PHI7_MS * 1.618 ** this._reconnects, PHI7_MS * 6);
    this._reconnects += 1;
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => { if (this.isConnected) this._open(); }, delay);
  }

  _onRecord(rec) {
    // Lens envelope: { ts, traceId, subject, detailTier, summary, payload:{build,step,summary,beat,...} }
    const p = rec?.payload ?? {};
    const beat = p.beat || (rec.subject || '').replace('heady.action.build.', '') || 'beat';
    this._beats.push({
      ts: rec.ts,
      traceId: rec.traceId,
      build: p.build,
      step: p.step,
      summary: p.summary ?? rec.summary,
      beat,
      rationale: p.rationale,
      score: p.score,
      threshold: p.threshold,
      passed: p.passed,
      durationMs: p.durationMs,
      waitingOn: p.waitingOn,
      error: p.error,
    });
    if (this._beats.length > MAX_BEATS) this._beats.splice(0, this._beats.length - MAX_BEATS);
    this._renderBeats();
  }

  _setStatus(state, detail = '') {
    this._status = state;
    const el = this.shadowRoot.querySelector('.hbn-status');
    if (!el) return;
    const map = {
      idle: ['#9aa', 'idle'],
      connecting: ['#ffb020', 'connecting…'],
      live: ['#00d4aa', 'live'],
      degraded: ['#7c5eff', `reconnecting${detail ? ` — ${esc(detail)}` : ''}`],
    };
    const [color, text] = map[state] || map.idle;
    el.style.setProperty('--dot', color);
    el.querySelector('.hbn-status-text').innerHTML = text;
  }

  _renderBeats() {
    const list = this.shadowRoot.querySelector('.hbn-stream');
    if (!list) return;
    // Newest first for a live feed.
    const rows = [...this._beats].reverse().map((b) => {
      const st = BEAT_STYLE[b.beat] || FALLBACK_STYLE;
      const t = b.ts ? new Date(b.ts).toLocaleTimeString() : '';
      const meta = [];
      if (b.build) meta.push(`<span class="hbn-build">${esc(b.build)}</span>`);
      if (b.durationMs != null) meta.push(`${Math.round(b.durationMs)}ms`);
      if (b.score != null) meta.push(`coherence ${Number(b.score).toFixed(3)}${b.threshold != null ? ` / ${Number(b.threshold).toFixed(3)}` : ''} ${b.passed ? '✓' : '✕'}`);
      if (b.waitingOn) meta.push(`waiting on ${esc(b.waitingOn)}`);
      const sub = b.rationale ? `<div class="hbn-sub">↳ ${esc(b.rationale)}</div>`
        : b.error ? `<div class="hbn-sub hbn-err">↳ ${esc(b.error)}</div>` : '';
      return `
        <li class="hbn-beat" style="--accent:${st.accent}">
          <span class="hbn-glyph">${st.glyph}</span>
          <div class="hbn-body">
            <div class="hbn-line">
              <span class="hbn-badge">${st.label}</span>
              <span class="hbn-step">${esc(b.step)}</span>
              <span class="hbn-time">${esc(t)}</span>
            </div>
            <div class="hbn-summary">${esc(b.summary)}</div>
            ${meta.length ? `<div class="hbn-meta">${meta.join(' · ')}</div>` : ''}
            ${sub}
          </div>
        </li>`;
    }).join('');
    list.innerHTML = rows || '<li class="hbn-empty">No build activity yet. Beats appear here the moment a build runs.</li>';
  }

  _renderShell() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; font: 13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; color:#dfe7ee; }
        .hbn-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
        .hbn-title { font-weight:600; letter-spacing:.04em; font-family: ui-sans-serif, system-ui, sans-serif; }
        .hbn-status { display:inline-flex; align-items:center; gap:6px; font-size:11px; text-transform:uppercase; letter-spacing:.08em; opacity:.85; }
        .hbn-status::before { content:''; width:8px; height:8px; border-radius:50%; background:var(--dot,#9aa); box-shadow:0 0 8px var(--dot,#9aa); }
        .hbn-stream { list-style:none; margin:0; padding:0; max-height:420px; overflow:auto; display:flex; flex-direction:column; gap:6px; }
        .hbn-beat { display:flex; gap:10px; padding:8px 10px; border-left:2px solid var(--accent,#00d4aa);
          background:rgba(255,255,255,.025); border-radius:0 8px 8px 0; }
        .hbn-glyph { color:var(--accent,#00d4aa); font-size:14px; line-height:1.4; }
        .hbn-body { flex:1; min-width:0; }
        .hbn-line { display:flex; align-items:baseline; gap:8px; }
        .hbn-badge { font-size:10px; letter-spacing:.08em; color:var(--accent,#00d4aa); border:1px solid var(--accent,#00d4aa);
          border-radius:4px; padding:0 5px; opacity:.9; }
        .hbn-step { font-weight:600; color:#fff; font-family: ui-sans-serif, system-ui, sans-serif; }
        .hbn-time { margin-left:auto; font-size:11px; opacity:.5; }
        .hbn-summary { margin-top:2px; word-break:break-word; }
        .hbn-meta { margin-top:3px; font-size:11px; opacity:.7; }
        .hbn-sub { margin-top:3px; font-size:12px; opacity:.8; font-style:italic; }
        .hbn-err { color:#ff8aa0; }
        .hbn-build { color:#7c5eff; }
        .hbn-empty { opacity:.5; padding:14px 4px; }
      </style>
      <div class="hbn-head">
        <span class="hbn-title">Live Build Narrative</span>
        <span class="hbn-status"><span class="hbn-status-text">idle</span></span>
      </div>
      <ul class="hbn-stream"><li class="hbn-empty">Connecting to HeadyLens…</li></ul>
    `;
  }
}

if (!customElements.get('heady-build-narrative')) {
  customElements.define('heady-build-narrative', HeadyBuildNarrative);
}
