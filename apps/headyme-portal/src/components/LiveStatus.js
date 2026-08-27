// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ <heady-live-status> v1.0.0                                ║
// ║  Compact live tile strip for the living dashboard. Four tiles:     ║
// ║  origin status · consistency-bus state · event-stream connection   ║
// ║  · last-event age. Updates PURELY from the origin SSE fabric       ║
// ║  (GET /api/events): the stream.hello bootstrap frame carries the   ║
// ║  origin health snapshot + consistency-bus state, and every         ║
// ║  subsequent transition event updates tiles in place — zero REST    ║
// ║  polling. Honest degraded states: when the stream drops, origin    ║
// ║  truth is shown dimmed with its as-of time, never faked fresh.     ║
// ║  φ backoff reconnect carries Last-Event-ID replay position.        ║
// ║  Colors: docs/design/design-tokens.json color.state + text.muted.  ║
// ║  Made with ❤️ by HeadySystems Inc.                                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import { events } from '../services/heady-api.js';

const PHI = 1.618033988749895;
const PHI7_MS = 29034;               // golden heartbeat (ADR-0026)
const MAX_BACKOFF_MS = PHI7_MS * 6;  // reconnect cap, matching ServiceNav
const TICK_MS = 987;                 // FIB[16] ms — age/countdown ticker

// Event-fabric subjects (heady-manager src/events.mjs taxonomy).
const EV_SERVICE_HEALTH = 'heady.system.service.health';
const EV_ORIGIN_STATUS = 'heady.system.origin.status';
const EV_HELLO = 'heady.system.stream.hello';

// design-tokens color.state (+ text.muted for unknown).
const STATE_COLOR = {
  healthy: '#00d4aa',
  degraded: '#7c5eff',
  blocked: '#ffb020',
  fail: '#ff5470',
  unknown: '#5a5a6a',
};

// Last-event freshness bands, φ-derived: the origin publishes at least one bus
// event per φ⁷ health poll, so ≤2 heartbeats = healthy, ≤6 = suspect, > = stale.
const FRESH_MS = PHI7_MS * 2;
const SUSPECT_MS = PHI7_MS * 6;

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export class HeadyLiveStatus extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._stream = null;
    this._streamState = 'connecting'; // connecting | live | offline
    this._streamRetries = 0;
    this._streamTimer = null;
    this._retryAt = null;
    this._lastEventId = null;
    this._lastEventAt = null;         // client-clock ms — age math without server skew
    this._origin = null;              // { status, checks, consistencyBus, at } from the fabric
    this._ticker = null;
  }

  connectedCallback() {
    this._renderShell();
    queueMicrotask(() => { if (this.isConnected) this._openStream(); });
    this._ticker = setInterval(() => this._renderTiles(), TICK_MS);
  }

  disconnectedCallback() {
    if (this._ticker) clearInterval(this._ticker);
    if (this._streamTimer) clearTimeout(this._streamTimer);
    if (this._stream) { this._stream.close(); this._stream = null; }
  }

  async _openStream() {
    if (this._stream) return;
    if (this._streamTimer) { clearTimeout(this._streamTimer); this._streamTimer = null; }
    this._streamState = 'connecting';
    this._retryAt = null;
    this._renderTiles();
    const token = await Promise.resolve(this.tokenProvider?.()).catch(() => '');
    this._stream = events.stream((evt) => this._onFabricEvent(evt), {
      token,
      lastEventId: this._lastEventId,
      onOpen: () => {
        this._streamState = 'live';
        this._streamRetries = 0;
        this._renderTiles();
      },
      onClose: () => {
        this._lastEventId = this._stream?.lastEventId() ?? this._lastEventId;
        this._stream = null;
        this._streamState = 'offline';
        if (!this.isConnected) return;
        // φ backoff: 1000·φⁿ ms (1.6s, 2.6s, 4.2s, …) capped at 6·φ⁷s.
        const delay = Math.min(1000 * PHI ** (this._streamRetries + 1), MAX_BACKOFF_MS);
        this._streamRetries += 1;
        this._retryAt = Date.now() + delay;
        this._renderTiles();
        this._streamTimer = setTimeout(() => { if (this.isConnected) this._openStream(); }, delay);
      },
    });
  }

  reconnect() {
    this._stream?.close();
    this._stream = null;
    this._openStream();
  }

  _onFabricEvent(evt) {
    if (!evt || typeof evt.type !== 'string') return;
    if (Number.isInteger(evt.id)) {
      this._lastEventId = evt.id;
      this._lastEventAt = Date.now(); // ring events only — hello is synthetic
    }
    if (evt.type === EV_HELLO && evt.payload?.origin) {
      this._origin = evt.payload.origin;
    } else if (evt.type === EV_ORIGIN_STATUS && typeof evt.payload?.status === 'string') {
      this._origin = { ...(this._origin ?? {}), status: evt.payload.status, checks: evt.payload.checks ?? this._origin?.checks, at: Date.now() };
    } else if (evt.type === EV_SERVICE_HEALTH && typeof evt.payload?.service === 'string') {
      if (this._origin?.checks) this._origin.checks[evt.payload.service] = evt.payload.status;
    }
    this._renderTiles();
  }

  _setTile(name, state, value, { stale = false, title = '' } = {}) {
    const tile = this.shadowRoot.querySelector(`.ls-tile[data-tile="${name}"]`);
    if (!tile) return;
    tile.style.setProperty('--dot', STATE_COLOR[state] ?? STATE_COLOR.unknown);
    tile.classList.toggle('stale', stale);
    tile.querySelector('.ls-value').textContent = value;
    tile.title = title;
  }

  _renderTiles() {
    if (!this.shadowRoot.querySelector('.ls-strip')) return;
    const live = this._streamState === 'live';

    // Origin — kernel-aggregated status; dimmed with as-of time when the feed is down.
    if (this._origin?.status) {
      const st = this._origin.status;
      const state = st === 'ok' ? 'healthy' : st === 'degraded' ? 'degraded' : 'fail';
      const asOf = this._origin.at ? new Date(this._origin.at).toLocaleTimeString() : 'unknown time';
      this._setTile('origin', state, live ? st : `${st} · as of ${asOf}`, {
        stale: !live,
        title: Object.entries(this._origin.checks ?? {}).map(([k, v]) => `${k}: ${v}`).join('\n'),
      });
    } else {
      this._setTile('origin', 'unknown', 'awaiting stream', { stale: !live });
    }

    // Consistency bus — from the /health-equivalent snapshot the hello frame carries.
    const cb = this._origin?.consistencyBus;
    if (cb && typeof cb.loaded === 'boolean') {
      if (cb.loaded) {
        this._setTile('bus', 'healthy', `${cb.linkedKeys} linked keys`, { stale: !live });
      } else {
        this._setTile('bus', 'degraded', 'passthrough — registry unreadable', { stale: !live, title: cb.error ?? '' });
      }
    } else {
      this._setTile('bus', 'unknown', 'awaiting stream', { stale: !live });
    }

    // Event stream — the connection's own truth, always current.
    if (live) {
      this._setTile('stream', 'healthy', 'live');
    } else if (this._streamState === 'connecting') {
      this._setTile('stream', 'blocked', 'connecting…');
    } else {
      const wait = this._retryAt ? Math.max(0, Math.ceil((this._retryAt - Date.now()) / 1000)) : null;
      this._setTile('stream', 'fail', wait != null ? `offline — retry in ${wait}s` : 'offline');
    }

    // Last event — client-clock age, φ-banded freshness; meaningless while offline.
    if (this._lastEventAt == null) {
      this._setTile('event', 'unknown', live ? 'none yet' : 'awaiting stream', { stale: !live });
    } else {
      const ageMs = Date.now() - this._lastEventAt;
      const ageText = ageMs < 60000 ? `${Math.round(ageMs / 1000)}s ago` : `${Math.round(ageMs / 60000)}m ago`;
      const state = ageMs <= FRESH_MS ? 'healthy' : ageMs <= SUSPECT_MS ? 'blocked' : 'fail';
      this._setTile('event', state, ageText, { stale: !live });
    }
  }

  _renderShell() {
    const tiles = [
      { key: 'origin', label: 'Origin' },
      { key: 'bus', label: 'Consistency bus' },
      { key: 'stream', label: 'Event stream' },
      { key: 'event', label: 'Last event' },
    ];
    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; font: 13px/1.45 Inter, ui-sans-serif, system-ui, sans-serif; color:#dfe7ee; }
        .ls-strip { display:flex; gap:9px; flex-wrap:wrap; }
        .ls-tile { flex:1 1 144px; min-width:144px; display:flex; align-items:center; gap:9px;
          padding:10px 13px; border:1px solid rgba(255,255,255,.09); border-radius:10px;
          background:rgba(255,255,255,.02); transition:opacity .382s ease; }
        .ls-tile.stale { opacity:.55; }
        .ls-dot { width:9px; height:9px; border-radius:50%; flex:none;
          background:var(--dot,${STATE_COLOR.unknown}); box-shadow:0 0 7px var(--dot,${STATE_COLOR.unknown});
          transition:background .382s ease, box-shadow .382s ease; }
        .ls-label { font-size:10.5px; text-transform:uppercase; letter-spacing:.08em; opacity:.6; }
        .ls-value { font-weight:600; color:#fff; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .ls-text { min-width:0; }
      </style>
      <div class="ls-strip">
        ${tiles.map((t) => `
          <div class="ls-tile" data-tile="${esc(t.key)}" style="--dot:${STATE_COLOR.unknown}">
            <span class="ls-dot"></span>
            <div class="ls-text">
              <div class="ls-label">${esc(t.label)}</div>
              <div class="ls-value">awaiting stream</div>
            </div>
          </div>`).join('')}
      </div>
    `;
  }
}

if (!customElements.get('heady-live-status')) {
  customElements.define('heady-live-status', HeadyLiveStatus);
}
