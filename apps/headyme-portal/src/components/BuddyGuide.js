// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ <heady-buddy-guide> v1.0.0                                ║
// ║  Vanilla Web Component: buddy-guided navigation. The user says     ║
// ║  what they need in their own words; Buddy resolves it against the  ║
// ║  REAL dispatcher (POST /api/service/resolve), explains the         ║
// ║  destination in one sentence, and offers exactly one Go action.    ║
// ║  Status honesty: confidence tiers spoken plainly; unreachable API  ║
// ║  renders an explicit "Buddy is offline" state — never faked.       ║
// ║  Spec: docs/blueprints/headyme-navigation-ia.md §5                 ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝
import { services } from '../services/heady-api.js';
import { serviceMeta, CATEGORIES } from '../services/service-categories.js';

const PHI = 1.618033988749895;
const RESOLVE_TIMEOUT_MS = Math.round(1000 * PHI ** 4); // φ⁴ s ≈ 6854ms
const MAX_INTENT_CHARS = 233; // FIB[13] — keeps intents sentence-sized

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Runtime shape guard for the /api/service/resolve response. */
function isValidResolve(d) {
  return !!d
    && d.ok === true
    && typeof d.resolved === 'string'
    && typeof d.confidence === 'number'
    && typeof d.endpoint === 'string'
    && typeof d.method === 'string'
    && Array.isArray(d.capabilities);
}

/** IA spec §5.2 — plain-words confidence honesty. */
function confidenceTier(resolved, confidence) {
  if (confidence >= 0.9) return { tone: 'good', text: 'Confident match.' };
  if (confidence >= 0.5) return { tone: 'ok', text: 'Likely match — check it’s what you meant.' };
  const base = 'Best guess. Heady wasn’t sure, so it picked the safest starting point.';
  if (resolved === 'chat' && confidence <= 0.3) {
    return { tone: 'low', text: `${base} Open chat is Heady’s default when nothing matched — it can route you from there.` };
  }
  return { tone: 'low', text: base };
}

export class HeadyBuddyGuide extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._tokenProvider = null;
    this._lastQuery = null; // { intent? , service? } — kept for honest retry
    this._busy = false;
  }

  /** The mounting view injects the Firebase ID token getter (AdminUI pattern). */
  set tokenProvider(fn) { this._tokenProvider = fn; }

  connectedCallback() {
    this._renderShell();
    this.shadowRoot.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const text = this.shadowRoot.querySelector('input').value.trim();
      if (text) this._resolve({ intent: text.slice(0, MAX_INTENT_CHARS) });
    });
  }

  /** Public: resolve an explicit service name (ServiceNav "Ask Buddy about this"). */
  askService(name) {
    if (typeof name === 'string' && name) this._resolve({ service: name });
  }

  async _resolve(query) {
    if (this._busy) return;
    this._busy = true;
    this._lastQuery = query;
    this._setStatus('thinking');
    this._renderResult('<p class="bg-muted">Buddy is checking the service directory…</p>');
    try {
      let token = '';
      try { token = (await this._tokenProvider?.()) ?? ''; } catch { /* anon — API may 401, surfaced honestly below */ }
      const timeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`no answer after ${RESOLVE_TIMEOUT_MS}ms`)), RESOLVE_TIMEOUT_MS);
      });
      const data = await Promise.race([services.resolve(query, token), timeout]);
      if (!isValidResolve(data)) throw new Error('resolver answered with an unexpected shape');
      this._setStatus('ready');
      this._renderResolved(data);
    } catch (err) {
      this._setStatus('offline');
      this._renderOffline(err);
    } finally {
      this._busy = false;
    }
  }

  _renderResolved(data) {
    const meta = serviceMeta(data.resolved, data.capabilities);
    const cat = CATEGORIES[meta.category] || CATEGORIES.more;
    const tier = confidenceTier(data.resolved, data.confidence);
    this._renderResult(`
      <div class="bg-card" data-tone="${tier.tone}">
        <div class="bg-kicker">${esc(cat.glyph)} ${esc(cat.label)}</div>
        <div class="bg-title">${esc(meta.label)} <code class="bg-code">${esc(meta.name)}</code></div>
        <p class="bg-blurb">${esc(meta.blurb)}</p>
        <p class="bg-tier">${esc(tier.text)} <span class="bg-conf">(confidence ${(data.confidence * 100).toFixed(0)}%)</span></p>
        <p class="bg-endpoint">${esc(data.method)} <code class="bg-code">${esc(data.endpoint)}</code></p>
        <button type="button" class="bg-go">Go to ${esc(meta.label)} →</button>
      </div>`);
    this.shadowRoot.querySelector('.bg-go')?.addEventListener('click', () => {
      // Composed + bubbling so the mounting view (ServicesUI) can route it.
      this.dispatchEvent(new CustomEvent('heady:buddy:go', {
        bubbles: true,
        composed: true,
        detail: { service: meta.name, category: meta.category, confidence: data.confidence },
      }));
    });
  }

  _renderOffline(err) {
    this._renderResult(`
      <div class="bg-card bg-offline">
        <div class="bg-title">HeadyBuddy is offline</div>
        <p class="bg-blurb">The service directory didn’t answer (${esc(err?.message || 'unknown error')}).
          Nothing is being guessed on your behalf — you can still browse the categories below.</p>
        <button type="button" class="bg-retry">Try again</button>
      </div>`);
    this.shadowRoot.querySelector('.bg-retry')?.addEventListener('click', () => {
      if (this._lastQuery) this._resolve(this._lastQuery);
    });
  }

  _renderResult(html) {
    this.shadowRoot.querySelector('.bg-result').innerHTML = html;
  }

  _setStatus(state) {
    const el = this.shadowRoot.querySelector('.bg-status');
    if (!el) return;
    const map = {
      idle: ['#9aa', 'ready when you are'],
      thinking: ['#ffb020', 'thinking…'],
      ready: ['#00d4aa', 'found it'],
      offline: ['#ff5470', 'offline'],
    };
    const [color, text] = map[state] || map.idle;
    el.style.setProperty('--dot', color);
    el.querySelector('.bg-status-text').textContent = text;
  }

  _renderShell() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; font: 14px/1.55 Inter, ui-sans-serif, system-ui, sans-serif; color:#dfe7ee; }
        .bg-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
        .bg-heading { font-weight:600; letter-spacing:.02em; }
        .bg-status { display:inline-flex; align-items:center; gap:6px; font-size:11px; text-transform:uppercase; letter-spacing:.08em; opacity:.85; }
        .bg-status::before { content:''; width:8px; height:8px; border-radius:50%; background:var(--dot,#9aa); box-shadow:0 0 8px var(--dot,#9aa); }
        form { display:flex; gap:8px; flex-wrap:wrap; }
        input { flex:1; min-width:210px; padding:10px 13px; border-radius:8px; border:1px solid rgba(255,255,255,.14);
          background:rgba(255,255,255,.05); color:#fff; font:inherit; }
        input:focus { outline:none; border-color:#00d4aa; box-shadow:0 0 0 2px rgba(0,212,170,.18); }
        button { padding:10px 16px; border-radius:8px; border:none; cursor:pointer; font:inherit; font-weight:600;
          background:#00d4aa; color:#04211b; }
        button:hover { filter:brightness(1.08); }
        .bg-result { margin-top:13px; }
        .bg-card { border:1px solid rgba(255,255,255,.1); border-left:3px solid #00d4aa; border-radius:0 10px 10px 0;
          background:rgba(255,255,255,.03); padding:13px 16px; display:flex; flex-direction:column; gap:5px; }
        .bg-card[data-tone="ok"]  { border-left-color:#ffb020; }
        .bg-card[data-tone="low"] { border-left-color:#7c5eff; }
        .bg-offline { border-left-color:#ff5470; }
        .bg-kicker { font-size:11px; text-transform:uppercase; letter-spacing:.09em; opacity:.7; }
        .bg-title { font-weight:600; font-size:15px; color:#fff; }
        .bg-blurb { margin:0; opacity:.85; }
        .bg-tier { margin:0; font-size:12.5px; opacity:.75; }
        .bg-conf { opacity:.6; }
        .bg-endpoint { margin:0; font-size:11.5px; opacity:.5; }
        .bg-code { font: 11.5px ui-monospace, SFMono-Regular, Menlo, monospace; background:rgba(255,255,255,.07);
          padding:1px 5px; border-radius:4px; }
        .bg-go, .bg-retry { align-self:flex-start; margin-top:6px; }
        .bg-retry { background:rgba(255,255,255,.1); color:#dfe7ee; }
        .bg-muted { opacity:.55; }
      </style>
      <div class="bg-head">
        <span class="bg-heading">Tell Heady what you need</span>
        <span class="bg-status" style="--dot:#9aa"><span class="bg-status-text">ready when you are</span></span>
      </div>
      <form>
        <input type="text" maxlength="${MAX_INTENT_CHARS}" placeholder="e.g. “scan my code for security holes” or “help me remember something”" aria-label="Tell Heady what you need" />
        <button type="submit">Ask Buddy</button>
      </form>
      <div class="bg-result" aria-live="polite"></div>
    `;
  }
}

if (!customElements.get('heady-buddy-guide')) {
  customElements.define('heady-buddy-guide', HeadyBuddyGuide);
}
