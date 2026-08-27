// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ <heady-console-honeycomb> v1.0.0 — the living honeycomb    ║
// ║  One HexCell per connector, reporting its own MEASURED state       ║
// ║  (§8): initial truth from GET /api/console/summary, live updates   ║
// ║  from the SSE fabric (console.connector.state). Canvas:drawer ≈    ║
// ║  φ:1; teal/violet/amber/red as state SIGNALS (design-tokens        ║
// ║  color.state); φ-heartbeat pulse on healthy cells (suppressed      ║
// ║  under prefers-reduced-motion); deploy-class cells carry the       ║
// ║  confused-deputy flag; per-session Enable/Disable; token_expired    ║
// ║  renders one-tap Re-authorize (dispatches `heady-reauthorize`,     ║
// ║  the OAuth-lifecycle integration point) — never a dead end.        ║
// ║  Made with ❤️ by HeadySystems Inc.                                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import { consoleApi, events } from '../services/heady-api.js';
import {
  summaryToCells, chunkRows, applyTransition,
  toggleDisabled, serializeDisabled, parseDisabled,
} from './console-logic.mjs';

const PHI = 1.618033988749895;
const PHI7_MS = 29034;              // φ⁷ heartbeat — matches the probe sweep
const PULSE_S = (PHI7_MS / 10000).toFixed(4); // 2.9034s ambient pulse period
const SESSION_KEY = 'heady.console.disabled';
const SUBJECT = 'console.connector.state';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export class HeadyConsoleHoneycomb extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._summary = null;
    this._error = null;
    this._selected = null;
    this._disabled = parseDisabled(globalThis.sessionStorage?.getItem(SESSION_KEY));
    this._stream = null;
  }

  connectedCallback() {
    this._render();
    queueMicrotask(() => { if (this.isConnected) this._connect(); });
  }

  async _connect() {
    const token = await Promise.resolve(this.tokenProvider?.()).catch(() => '');
    await this._load(token);
    this._stream = events.stream((evt) => {
      if (evt?.type !== SUBJECT || !this._summary) return;
      this._summary = applyTransition(this._summary, { id: evt.payload.id, to: evt.payload.to, detail: evt.payload.detail });
      this._render();
    }, { token, onOpen: () => this._load(token) }); // reconnect ⇒ refresh the full truth
  }

  disconnectedCallback() {
    this._stream?.close();
    this._stream = null;
  }

  reconnect() {
    this._stream?.close();
    this._stream = null;
    this._connect();
  }

  async _load(existingToken) {
    try {
      const token = existingToken || await Promise.resolve(this.tokenProvider?.()).catch(() => '');
      this._summary = await consoleApi.summary(token);
      this._error = null;
    } catch (err) {
      // Honest global-error state — the honeycomb never renders stale cells as fresh.
      this._error = String(err?.message ?? err);
    }
    this._render();
  }

  _toggle(id) {
    this._disabled = toggleDisabled(this._disabled, id);
    globalThis.sessionStorage?.setItem(SESSION_KEY, serializeDisabled(this._disabled));
    this._render();
  }

  _cells() { return summaryToCells(this._summary, this._disabled); }

  _drawer(cell) {
    if (!cell) return '<p class="muted">Select a cell — every value below is measured, never asserted.</p>';
    const rows = [
      ['state', cell.style.label], ['detail', cell.detail ?? '—'],
      ['latency', cell.latencyMs != null ? `${cell.latencyMs}ms` : '—'],
      ['checked', cell.checkedAt ?? '—'], ['kind', cell.kind], ['role', cell.role],
      ['expected', cell.expected], ['deploy-class', cell.deploy_class ? '⚠ yes (confused-deputy surface)' : 'no'],
    ];
    return `
      <h3 style="color:${cell.style.color}">${esc(cell.name)}</h3>
      ${cell.note ? `<p class="note">⚠ ${esc(cell.note)}</p>` : ''}
      <dl>${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
      ${cell.style.action === 'reauthorize'
    ? `<button type="button" class="reauth" data-reauth="${esc(cell.id)}">Re-authorize</button>` : ''}
      <button type="button" class="toggle" data-toggle="${esc(cell.id)}">
        ${cell.disabled ? 'Enable (session)' : 'Disable (session)'}
      </button>`;
  }

  _render() {
    const cells = this._cells();
    const rows = chunkRows(cells, 5);
    const selected = cells.find((c) => c.id === this._selected) ?? null;
    const counts = this._summary?.counts ?? {};

    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; font-family:'Inter', system-ui, sans-serif; color:#f0f4f8; }
        .layout { display:grid; grid-template-columns:${PHI}fr 1fr; gap:21px; }
        .banner { font-family:'JetBrains Mono', monospace; font-size:12px; color:#8b9bb4; margin:0 0 13px; }
        .banner .err { color:#ff5470; }
        .row { display:flex; gap:5px; margin-bottom:-13px; }
        .row.offset { margin-left:47px; }
        .hex { position:relative; width:89px; height:102px; display:flex; flex-direction:column;
          align-items:center; justify-content:center; cursor:pointer; text-align:center;
          clip-path:polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
          background:rgba(25,30,36,.85); border:none; padding:0; color:inherit; font:inherit; }
        .hex .fill { position:absolute; inset:2px;
          clip-path:polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
          background:color-mix(in srgb, var(--c) 16%, #12151a); }
        .hex.ghost .fill { background:#12151a; outline:1px dashed color-mix(in srgb, var(--c) 55%, transparent); outline-offset:-8px; }
        .hex .dot { position:relative; width:9px; height:9px; border-radius:50%; background:var(--c);
          box-shadow:0 0 8px var(--c); margin-bottom:5px; }
        .hex.pulse .dot { animation:phi-pulse ${PULSE_S}s ease-in-out infinite; }
        @keyframes phi-pulse { 0%,100% { opacity:1; transform:scale(1); } 61.8% { opacity:.55; transform:scale(.786); } }
        @media (prefers-reduced-motion: reduce) { .hex.pulse .dot { animation:none; } }
        .hex .nm { position:relative; font-size:10px; line-height:1.2; max-width:76px; color:#c9d4e3; }
        .hex .st { position:relative; font-family:'JetBrains Mono', monospace; font-size:9px; color:var(--c); }
        .hex .dc { position:absolute; top:14px; right:16px; font-size:10px; color:#ffb020; }
        .hex.disabled { opacity:.34; }
        .hex.selected { outline:2px solid var(--c); outline-offset:-2px; }
        .drawer { background:rgba(25,30,36,.6); border:1px solid rgba(255,255,255,.08);
          border-radius:8px; padding:13px 21px; min-height:144px; }
        .drawer dl { display:grid; grid-template-columns:auto 1fr; gap:3px 13px;
          font-family:'JetBrains Mono', monospace; font-size:11px; }
        .drawer dt { color:#8b9bb4; } .drawer dd { margin:0; }
        .drawer .note { color:#ffb020; font-size:12px; }
        .drawer button { margin-top:8px; margin-right:8px; background:transparent; color:#c9d4e3;
          border:1px solid rgba(255,255,255,.21); border-radius:5px; padding:5px 13px; cursor:pointer; }
        .drawer button.reauth { border-color:#ffb020; color:#ffb020; }
        .muted { color:#8b9bb4; }
      </style>
      <p class="banner">
        ${this._error
    ? `<span class="err">global-error: ${esc(this._error)}</span>`
    : `heartbeat ${this._summary?.heartbeatMs ?? '…'}ms · ${cells.length} connectors · healthy ${counts.healthy ?? 0} · attention ${(counts.unreachable ?? 0) + (counts.token_expired ?? 0)}`}
      </p>
      <div class="layout">
        <div class="canvas">
          ${rows.map((row, i) => `
            <div class="row${i % 2 ? ' offset' : ''}">
              ${row.map((c) => `
                <button type="button" class="hex${c.style.pulse && !c.disabled ? ' pulse' : ''}${c.style.ghost ? ' ghost' : ''}${c.disabled ? ' disabled' : ''}${c.id === this._selected ? ' selected' : ''}"
                  style="--c:${c.style.color}" data-cell="${esc(c.id)}"
                  aria-label="${esc(c.name)}: ${esc(c.style.label)}">
                  ${c.deploy_class ? '<span class="dc">⚠</span>' : ''}
                  <span class="dot"></span>
                  <span class="nm">${esc(c.name)}</span>
                  <span class="st">${esc(c.style.label)}</span>
                </button>`).join('')}
            </div>`).join('')}
        </div>
        <aside class="drawer">${this._drawer(selected)}</aside>
      </div>`;

    this.shadowRoot.querySelectorAll('[data-cell]').forEach((el) => {
      el.addEventListener('click', () => { this._selected = el.dataset.cell; this._render(); });
    });
    this.shadowRoot.querySelector('[data-toggle]')?.addEventListener('click', (e) => this._toggle(e.target.dataset.toggle));
    this.shadowRoot.querySelector('[data-reauth]')?.addEventListener('click', (e) => {
      // The OAuth-lifecycle integration point (§8): the portal shell owns the
      // re-auth flow; this cell only announces the need — never a dead end.
      this.dispatchEvent(new CustomEvent('heady-reauthorize', {
        detail: { id: e.target.dataset.reauth }, bubbles: true, composed: true,
      }));
    });
  }
}

customElements.define('heady-console-honeycomb', HeadyConsoleHoneycomb);
