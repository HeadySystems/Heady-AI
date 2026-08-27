// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Legacy Advisor Panel v1.0.0                               ║
// ║  Native read interface to heady-production Expert Advisor.        ║
// ║  Auth: Firebase ID token (same session as AdminUI).               ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝
import { auth, signOut } from '../services/firebase.js';
import { legacyApi }     from '../services/heady-api.js';

const PHI = 1.618033988749895;
const DOMAINS = ['auth', 'routing', 'vector', 'csl', 'swarm', 'pipeline'];

export class LegacyUI {
  constructor(container, user) {
    this.container = container;
    this.user       = user;
    this._streamSrc = null;
  }

  render() {
    this.container.innerHTML = `
      <nav class="system-tabs glass-panel" aria-label="System switcher">
        <a href="#admin"  class="tab-btn" aria-current="false">
          ⬡ Rebuild <span class="tab-badge rebuild">PRIMARY</span>
        </a>
        <a href="#legacy" class="tab-btn active" aria-current="page">
          ◈ Legacy <span class="tab-badge legacy">ADVISOR</span>
        </a>
        <a href="#services" class="tab-btn" aria-current="false">
          ⬢ Services <span class="tab-badge services">GUIDE</span>
        </a>
      </nav>

      <div class="legacy-dashboard">
        <header class="admin-header glass-panel">
          <div class="header-content">
            <div>
              <h1>Heady™ Legacy Advisor</h1>
              <p class="muted" style="font-size:0.8rem;margin:4px 0 0">
                Expert reference — 8,542 commits of battle-tested knowledge
              </p>
            </div>
            <div class="user-info">
              <span>${this.user.email}</span>
              <button id="logout-btn" class="secondary-btn small">Disconnect</button>
            </div>
          </div>
        </header>

        <main class="dashboard-grid">
          <!-- Row 1: status cards -->
          <section class="card glass-panel" id="legacy-health">
            <h2>Service Health</h2>
            <div class="status-indicator loading">…</div>
            <p class="card-detail">—</p>
          </section>

          <section class="card glass-panel" id="legacy-swarm">
            <h2>Swarm Status</h2>
            <div class="status-indicator loading">…</div>
            <p class="card-detail">—</p>
          </section>

          <section class="card glass-panel" id="legacy-baseline">
            <h2>Baseline vs Rebuild</h2>
            <div class="status-indicator loading">…</div>
            <p class="card-detail">—</p>
            <div id="baseline-table"></div>
          </section>

          <!-- Row 2: Pattern Advisor -->
          <section class="card glass-panel pattern-panel" style="grid-column: 1 / -1">
            <h2>Pattern Advisor
              <span class="muted" style="font-size:0.75rem;font-weight:400">
                — query working patterns from legacy
              </span>
            </h2>
            <div class="pattern-controls">
              ${DOMAINS.map(d =>
                `<button class="secondary-btn small domain-btn" data-domain="${d}">${d}</button>`
              ).join('')}
            </div>
            <pre id="pattern-output" class="pattern-block muted" style="margin-top:13px">
Select a domain above.</pre>
          </section>

          <!-- Row 3: Live Log Stream -->
          <section class="card glass-panel" style="grid-column: 1 / -1">
            <h2>Live Log Stream
              <span class="muted" style="font-size:0.75rem;font-weight:400">
                — legacy Cloud Run structured logs (SSE)
              </span>
            </h2>
            <div id="legacy-stream-container"></div>
          </section>
        </main>
      </div>`;

    // events
    this.container.querySelector('#logout-btn')
      .addEventListener('click', () => { this._destroyStream(); signOut(auth); });

    this.container.querySelectorAll('.domain-btn')
      .forEach(btn => btn.addEventListener('click', () =>
        this.loadPattern(btn.dataset.domain)));

    window.dispatchEvent(new CustomEvent('navigation:legacy:entered'));

    // parallel data load
    this.loadHealth();
    this.loadSwarm();
    this.loadBaseline();
    this.initStream();
  }

  // ── helpers ────────────────────────────────────────────────────────
  async token() {
    try { return await this.user.getIdToken(); } catch { return ''; }
  }

  setCard(sel, state, text) {
    const el = this.container.querySelector(sel);
    if (!el) return;
    const ind = el.querySelector('.status-indicator');
    ind.className = `status-indicator ${state}`;
    ind.textContent = state === 'online' ? 'Live'
                    : state === 'alert'  ? 'Attention'
                    : state === 'loading'? '…'
                    :                      'Offline';
    const detail = el.querySelector('.card-detail');
    if (detail) detail.textContent = text;
  }

  // ── data loaders ───────────────────────────────────────────────────
  async loadHealth() {
    try {
      const tok = await this.token();
      const h   = await legacyApi.health(tok);
      this.setCard('#legacy-health',
        h.status === 'healthy' ? 'online' : 'alert',
        `Uptime ${h.uptimeHours}h · Last auto-commit ${h.lastAutoCommit ?? 'unknown'} · ${h.services} services`
      );
    } catch (e) {
      this.setCard('#legacy-health', 'offline', `Advisor unreachable: ${e.message}`);
    }
  }

  async loadSwarm() {
    try {
      const tok = await this.token();
      const s   = await legacyApi.swarmStatus(tok);
      this.setCard('#legacy-swarm', 'online',
        `${s.active}/${s.total} swarms active · ${s.beesRunning} bees running · ${s.beesIdle} idle`
      );
    } catch (e) {
      this.setCard('#legacy-swarm', 'offline', e.message);
    }
  }

  async loadBaseline() {
    try {
      const tok = await this.token();
      const b   = await legacyApi.baseline(tok);
      const rows = b.metrics.map(m => {
        const legacyWins  = m.name.includes('alerts') || m.name.includes('PRs') || m.name.includes('secrets')
                            ? m.legacy <= m.rebuild : m.legacy >= m.rebuild;
        const rebuildWins = m.name.includes('alerts') || m.name.includes('PRs') || m.name.includes('secrets')
                            ? m.rebuild <= m.legacy  : m.rebuild >= m.legacy;
        return `<tr>
          <td>${m.name}</td>
          <td class="${legacyWins  ? 'ok' : 'warn'}">${m.legacy}</td>
          <td class="${rebuildWins ? 'ok' : 'warn'}">${m.rebuild}</td>
        </tr>`;
      }).join('');
      this.container.querySelector('#baseline-table').innerHTML = `
        <table class="baseline-table">
          <thead><tr><th>Metric</th><th>Legacy</th><th>Rebuild</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
      this.setCard('#legacy-baseline', 'online', `${b.metrics.length} metrics compared`);
    } catch (e) {
      this.setCard('#legacy-baseline', 'offline', e.message);
    }
  }

  async loadPattern(domain) {
    const out = this.container.querySelector('#pattern-output');
    out.textContent = `Loading ${domain} patterns…`;
    out.classList.remove('error');
    try {
      const tok = await this.token();
      const p   = await legacyApi.patterns(domain, tok);
      out.textContent = JSON.stringify(p, null, 2);
    } catch (e) {
      out.classList.add('error');
      out.textContent = e.message;
    }
  }

  // ── SSE stream ─────────────────────────────────────────────────────
  _destroyStream() {
    if (this._streamSrc) { this._streamSrc.close(); this._streamSrc = null; }
  }

  initStream() {
    const wrap = this.container.querySelector('#legacy-stream-container');
    wrap.innerHTML = `
      <div id="legacy-log" class="log-stream" role="log" aria-live="polite"
           style="height:200px;overflow-y:auto;font-family:monospace;font-size:0.78rem;
                  background:rgba(0,0,0,0.3);border-radius:5px;padding:8px 13px"></div>
      <p id="stream-status" class="muted" style="font-size:0.72rem;margin-top:4px">
        Connecting…
      </p>`;

    const logDiv  = wrap.querySelector('#legacy-log');
    const status  = wrap.querySelector('#stream-status');
    let attempt   = 0;

    const appendLine = (d) => {
      const line = document.createElement('p');
      line.style.cssText = 'margin:2px 0;color:inherit';
      const lvl = (d.level || 'INFO').toUpperCase();
      const col = lvl === 'ERROR' ? '#ff6b6b'
                : lvl === 'WARN'  ? '#ffd93d'
                : lvl === 'DEBUG' ? '#8a8a9a'
                : '#c0caf5';
      line.style.color = col;
      line.textContent = `[${lvl}] ${d.msg ?? d.message ?? JSON.stringify(d)}`;
      logDiv.appendChild(line);
      // keep last 89 (fib[11]) lines
      while (logDiv.children.length > 89) logDiv.removeChild(logDiv.firstChild);
      logDiv.scrollTop = logDiv.scrollHeight;
    };

    // The advisor stream is Bearer-guarded; EventSource cannot send an
    // Authorization header, so this rides legacyApi.stream (fetch + SSE parser).
    const connect = async () => {
      this._destroyStream();
      const tok = await this.token();
      this._streamSrc = legacyApi.stream(tok, {
        onOpen: () => {
          attempt = 0;
          status.textContent = 'Connected — streaming live logs';
        },
        onLine: appendLine,
        onClose: () => {
          attempt++;
          // PHI^attempt reconnect backoff (ms), capped at fib[13]=233s
          const delay = Math.min(1000 * Math.pow(PHI, attempt), 233000);
          status.textContent = `Reconnecting in ${(delay / 1000).toFixed(1)}s… (attempt ${attempt})`;
          this._destroyStream();
          setTimeout(connect, delay);
        },
      });
    };

    connect();
  }
}
