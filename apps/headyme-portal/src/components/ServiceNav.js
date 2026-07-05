// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ <heady-service-nav> v1.1.0                                ║
// ║  Vanilla Web Component: the categorized Heady service directory.   ║
// ║  Fetches the LIVE catalog (GET /api/service/catalog), groups it    ║
// ║  by the navigation IA (7 categories + More fallback keyed by       ║
// ║  service name — unknown services degrade, never break), renders    ║
// ║  progressive-disclosure <details> with plain-language labels.      ║
// ║  v1.1: subscribes to the origin SSE fabric (GET /api/events) —     ║
// ║  service-health transitions update badges IN PLACE (no refetch),   ║
// ║  with an honest live/offline stream indicator + φ backoff          ║
// ║  reconnect carrying Last-Event-ID replay position.                 ║
// ║  Honest states: directory-unavailable + health-unknown are shown   ║
// ║  as exactly that. φ⁷ heartbeat (29034ms) retry cadence.            ║
// ║  Spec: docs/blueprints/headyme-navigation-ia.md §3/§5.3            ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝
import { services, events } from '../services/heady-api.js';
import { buildGroups } from '../services/service-categories.js';

const PHI = 1.618033988749895;
const PHI7_MS = 29034;               // golden heartbeat (ADR-0026) — retry base
const MAX_BACKOFF_MS = PHI7_MS * 6;  // cap, matching heady-build-narrative

// Event-fabric subjects (heady-manager src/events.mjs taxonomy).
const EV_SERVICE_HEALTH = 'heady.system.service.health';
const EV_ORIGIN_STATUS = 'heady.system.origin.status';
const EV_HELLO = 'heady.system.stream.hello';

// State colors from docs/design/design-tokens.json color.state (+ text.muted for unknown).
const STATE_COLOR = {
  healthy: '#00d4aa',
  degraded: '#7c5eff',
  blocked: '#ffb020',
  fail: '#ff5470',
  unknown: '#5a5a6a',
};

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Runtime shape guard for the /api/service/catalog response. */
function isValidCatalog(d) {
  return !!d && d.ok === true && Array.isArray(d.services)
    && d.services.every((s) => s && typeof s.name === 'string' && typeof s.endpoint === 'string' && typeof s.method === 'string');
}

export class HeadyServiceNav extends HTMLElement {
  static get observedAttributes() { return ['selected']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._tokenProvider = null;
    this._groups = null;
    this._health = null;      // dispatcher health or null = unknown (shown honestly)
    this._count = 0;
    this._retries = 0;
    this._timer = null;
    // SSE fabric state — live badges update in place, never via refetch.
    this._stream = null;
    this._streamLive = false;
    this._streamRetries = 0;
    this._streamTimer = null;
    this._lastEventId = null;
    this._kernelChecks = null; // last known origin checks (re-applied after re-render)
  }

  /** The mounting view injects the Firebase ID token getter (AdminUI pattern). */
  set tokenProvider(fn) { this._tokenProvider = fn; }

  connectedCallback() {
    this._renderShell();
    this._load();
  }

  disconnectedCallback() {
    if (this._timer) clearTimeout(this._timer);
    if (this._streamTimer) clearTimeout(this._streamTimer);
    if (this._stream) { this._stream.close(); this._stream = null; }
  }

  attributeChangedCallback(name) {
    if (name === 'selected' && this._groups) this._applySelection();
  }

  async _load() {
    this._setStatus('loading', 'loading directory…');
    let token = '';
    try { token = (await this._tokenProvider?.()) ?? ''; } catch { /* anon — API may 401, surfaced honestly */ }

    try {
      const data = await services.catalog(token);
      if (!isValidCatalog(data)) throw new Error('catalog answered with an unexpected shape');
      this._groups = buildGroups(data.services);
      this._retries = 0;

      // Health is additive truth: catalog can be fine while health is unknown.
      try {
        const h = await services.health(token);
        this._health = (h && h.ok === true) ? h : null;
      } catch { this._health = null; }

      this._count = data.services.length;
      this._renderGroups();
      this._applySelection();
      this._openStream(); // catalog is up — go live on the event fabric
      this._renderStreamStatus();
    } catch (err) {
      this._renderUnavailable(err);
      // φ⁷ golden-heartbeat backoff, capped — plus the manual Retry button.
      const delay = Math.min(PHI7_MS * PHI ** this._retries, MAX_BACKOFF_MS);
      this._retries += 1;
      this._setStatus('offline', `directory unavailable — retrying in ${Math.round(delay / 1000)}s`);
      if (this._timer) clearTimeout(this._timer);
      this._timer = setTimeout(() => { if (this.isConnected) this._load(); }, delay);
    }
  }

  _healthLine(count) {
    if (!this._health) return `${count} services · dispatcher health unknown`;
    return `${this._health.totalServices ?? count} services · ${this._health.recentSuccessRate}% recent success · ${this._health.avgLatencyMs}ms avg`;
  }

  // ── SSE event fabric: live badges, honest live/offline indicator ──

  /** Header dot+text tells the truth about the stream, not just the catalog. */
  _renderStreamStatus(extra) {
    const line = this._healthLine(this._count);
    if (this._streamLive) this._setStatus('live', `live${extra ? ` · ${extra}` : ''} · ${line}`);
    else if (this._stream) this._setStatus('loading', `${extra ?? 'connecting live stream…'} · ${line}`);
    else this._setStatus('offline', `${extra ?? 'stream offline'} · ${line}`);
  }

  _openStream() {
    if (this._stream) return; // already connected or reconnecting
    if (this._streamTimer) { clearTimeout(this._streamTimer); this._streamTimer = null; }
    this._stream = events.stream((evt) => this._onFabricEvent(evt), {
      lastEventId: this._lastEventId, // replay what we missed while offline
      onOpen: () => {
        this._streamLive = true;
        this._streamRetries = 0;
        this._renderStreamStatus();
      },
      onClose: () => {
        this._lastEventId = this._stream?.lastEventId() ?? this._lastEventId;
        this._stream = null;
        this._streamLive = false;
        if (!this.isConnected) return;
        // φ backoff: 1000·φⁿ ms (1.6s, 2.6s, 4.2s, …) capped at 6·φ⁷s.
        const delay = Math.min(1000 * PHI ** (this._streamRetries + 1), MAX_BACKOFF_MS);
        this._streamRetries += 1;
        this._renderStreamStatus(`stream offline — reconnecting in ${Math.round(delay / 1000)}s`);
        this._streamTimer = setTimeout(() => { if (this.isConnected) this._openStream(); }, delay);
      },
    });
  }

  _onFabricEvent(evt) {
    if (!evt || typeof evt.type !== 'string') return;
    if (Number.isInteger(evt.id)) this._lastEventId = evt.id;
    if (evt.type === EV_HELLO) {
      // Bootstrap: seed badges from the origin's current per-service checks.
      const checks = evt.payload?.origin?.checks;
      if (checks && typeof checks === 'object') {
        this._kernelChecks = { ...checks };
        this._applyBadges();
      }
      return;
    }
    if (evt.type === EV_SERVICE_HEALTH) {
      const { service, status } = evt.payload ?? {};
      if (typeof service !== 'string' || typeof status !== 'string') return;
      this._kernelChecks = { ...(this._kernelChecks ?? {}), [service]: status };
      this._applyBadge(service, status);
      return;
    }
    if (evt.type === EV_ORIGIN_STATUS) {
      const { status } = evt.payload ?? {};
      if (typeof status === 'string') this._renderStreamStatus(status === 'ok' ? undefined : `origin ${status}`);
    }
  }

  /** Update ONE health badge in place — no refetch, no re-render. */
  _applyBadge(service, status) {
    const dot = this.shadowRoot.querySelector(`.sn-health[data-health-for="${CSS.escape(service)}"]`);
    if (!dot) return; // event about a service not in this directory — fine
    const state = status === 'ok' ? 'ok' : status === 'degraded' ? 'degraded' : 'down';
    dot.dataset.state = state;
    dot.title = `live health: ${status}`;
  }

  /** Re-apply every known check (after a directory re-render resets badges). */
  _applyBadges() {
    if (!this._kernelChecks) return;
    for (const [service, status] of Object.entries(this._kernelChecks)) this._applyBadge(service, status);
  }

  _renderUnavailable(err) {
    const body = this.shadowRoot.querySelector('.sn-body');
    body.innerHTML = `
      <div class="sn-down">
        <div class="sn-down-title">Service directory unavailable</div>
        <p>The live catalog didn’t answer (${esc(err?.message || 'unknown error')}).
           This list is never cached or faked — it returns the moment the API does.</p>
        <button type="button" class="sn-retry">Retry now</button>
      </div>`;
    body.querySelector('.sn-retry')?.addEventListener('click', () => {
      if (this._timer) clearTimeout(this._timer);
      this._load();
    });
  }

  _renderGroups() {
    const body = this.shadowRoot.querySelector('.sn-body');
    body.innerHTML = this._groups.map((g) => `
      <details class="sn-cat" data-category="${esc(g.key)}">
        <summary>
          <span class="sn-cat-glyph">${esc(g.glyph)}</span>
          <span class="sn-cat-label">${esc(g.label)}</span>
          <span class="sn-cat-count">${g.services.length}</span>
          <span class="sn-cat-blurb">${esc(g.blurb)}</span>
        </summary>
        <ul class="sn-list">
          ${g.services.map((s) => `
            <li>
              <details class="sn-svc" data-service="${esc(s.name)}">
                <summary>
                  <span class="sn-health" data-health-for="${esc(s.name)}" data-state="unknown" title="live health: unknown"></span>
                  <span class="sn-svc-label">${esc(s.label)}</span>
                  <code class="sn-code">${esc(s.name)}</code>
                </summary>
                <div class="sn-svc-body">
                  <p class="sn-blurb">${esc(s.blurb)}</p>
                  <p class="sn-detail">${esc(s.method)} <code class="sn-code">${esc(s.endpoint)}</code>
                    ${s.component ? `· runs on <code class="sn-code">${esc(s.component)}</code>` : ''}</p>
                  ${Array.isArray(s.capabilities) && s.capabilities.length
                    ? `<p class="sn-caps">${s.capabilities.map((c) => `<span class="sn-cap">${esc(c)}</span>`).join(' ')}</p>` : ''}
                  <button type="button" class="sn-ask" data-service="${esc(s.name)}">Ask Buddy about this</button>
                </div>
              </details>
            </li>`).join('')}
        </ul>
      </details>`).join('');

    this._applyBadges(); // a re-render resets badges — restore known live health

    body.querySelectorAll('.sn-ask').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.dispatchEvent(new CustomEvent('heady:services:ask-buddy', {
          bubbles: true,
          composed: true,
          detail: { service: btn.dataset.service },
        }));
      });
    });
  }

  /** `selected` attribute = "category/service" (route #services/<cat>/<svc>). */
  _applySelection() {
    const sel = this.getAttribute('selected') || '';
    const [category, service] = sel.split('/');
    this.shadowRoot.querySelectorAll('.sn-svc.selected').forEach((el) => el.classList.remove('selected'));
    if (!category) return;
    const cat = this.shadowRoot.querySelector(`.sn-cat[data-category="${CSS.escape(category)}"]`);
    if (cat) cat.open = true;
    if (!service) return;
    const svc = this.shadowRoot.querySelector(`.sn-svc[data-service="${CSS.escape(service)}"]`);
    if (svc) {
      svc.open = true;
      svc.classList.add('selected');
      svc.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  _setStatus(state, text) {
    const el = this.shadowRoot.querySelector('.sn-status');
    if (!el) return;
    // design-tokens color.state: blocked=loading, healthy=live, fail=offline.
    const colors = { loading: STATE_COLOR.blocked, live: STATE_COLOR.healthy, offline: STATE_COLOR.fail };
    el.style.setProperty('--dot', colors[state] || STATE_COLOR.unknown);
    el.querySelector('.sn-status-text').textContent = text;
  }

  _renderShell() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; font: 14px/1.55 Inter, ui-sans-serif, system-ui, sans-serif; color:#dfe7ee; }
        .sn-head { display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; margin-bottom:10px; }
        .sn-heading { font-weight:600; letter-spacing:.02em; }
        .sn-status { display:inline-flex; align-items:center; gap:6px; font-size:11px; text-transform:uppercase; letter-spacing:.08em; opacity:.85; }
        .sn-status::before { content:''; width:8px; height:8px; border-radius:50%; background:var(--dot,#9aa); box-shadow:0 0 8px var(--dot,#9aa); }
        details { border:1px solid rgba(255,255,255,.09); border-radius:10px; background:rgba(255,255,255,.02); }
        details > summary { list-style:none; cursor:pointer; display:flex; align-items:baseline; gap:9px;
          padding:12px 15px; min-height:44px; box-sizing:border-box; flex-wrap:wrap; }
        details > summary::-webkit-details-marker { display:none; }
        .sn-cat { margin-bottom:9px; }
        .sn-cat[open] { border-color:rgba(0,212,170,.35); }
        .sn-cat-glyph { opacity:.9; }
        .sn-cat-label { font-weight:600; color:#fff; }
        .sn-cat-count { font-size:11px; background:rgba(255,255,255,.08); border-radius:8px; padding:1px 8px; opacity:.8; }
        .sn-cat-blurb { flex-basis:100%; font-size:12.5px; opacity:.6; }
        .sn-list { list-style:none; margin:0; padding:4px 12px 12px; display:flex; flex-direction:column; gap:6px; }
        .sn-svc summary { padding:9px 12px; }
        .sn-svc.selected { border-color:#00d4aa; box-shadow:0 0 0 1px rgba(0,212,170,.4); }
        /* Live health badge — design-tokens color.state; unknown = text.muted. */
        .sn-health { width:8px; height:8px; border-radius:50%; align-self:center; flex:none;
          background:${STATE_COLOR.unknown}; transition:background .382s ease, box-shadow .382s ease; }
        .sn-health[data-state="ok"] { background:${STATE_COLOR.healthy}; box-shadow:0 0 6px ${STATE_COLOR.healthy}; }
        .sn-health[data-state="degraded"] { background:${STATE_COLOR.degraded}; box-shadow:0 0 6px ${STATE_COLOR.degraded}; }
        .sn-health[data-state="down"] { background:${STATE_COLOR.fail}; box-shadow:0 0 6px ${STATE_COLOR.fail}; }
        .sn-svc-label { font-weight:500; color:#fff; }
        .sn-svc-body { padding:0 13px 12px; display:flex; flex-direction:column; gap:6px; }
        .sn-blurb { margin:0; opacity:.85; }
        .sn-detail { margin:0; font-size:11.5px; opacity:.55; }
        .sn-caps { margin:0; display:flex; flex-wrap:wrap; gap:5px; }
        .sn-cap { font-size:10.5px; text-transform:uppercase; letter-spacing:.05em; padding:2px 7px;
          border-radius:8px; background:rgba(124,94,255,.14); color:#b9a8ff; }
        .sn-code { font: 11.5px ui-monospace, SFMono-Regular, Menlo, monospace; background:rgba(255,255,255,.07);
          padding:1px 5px; border-radius:4px; }
        button { align-self:flex-start; padding:8px 13px; border-radius:8px; border:none; cursor:pointer;
          font:inherit; font-size:13px; font-weight:600; background:rgba(0,212,170,.14); color:#00d4aa; }
        button:hover { background:rgba(0,212,170,.24); }
        .sn-down { border:1px solid rgba(255,84,112,.4); border-radius:10px; padding:14px 16px; }
        .sn-down-title { font-weight:600; color:#ff8aa0; margin-bottom:4px; }
        .sn-down p { margin:0 0 10px; opacity:.8; }
        .sn-empty { opacity:.5; padding:14px 4px; }
      </style>
      <div class="sn-head">
        <span class="sn-heading">Browse Heady services</span>
        <span class="sn-status" style="--dot:#9aa"><span class="sn-status-text">idle</span></span>
      </div>
      <div class="sn-body"><p class="sn-empty">Loading the live service directory…</p></div>
    `;
  }
}

if (!customElements.get('heady-service-nav')) {
  customElements.define('heady-service-nav', HeadyServiceNav);
}
