// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Admin Control Plane v3.0.0 — Dual-State Tab Strip         ║
// ║  Adds system-tabs nav bar; all existing panels unchanged.          ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝
import { auth, signOut } from '../services/firebase.js';
import { api } from '../services/heady-api.js';
import './heady-build-narrative.js'; // registers <heady-build-narrative>
import './ConsoleHoneycomb.js'; // registers <heady-console-honeycomb> (§8 living honeycomb)

const TAB_NAV = `
<nav class="system-tabs glass-panel" aria-label="System switcher">
  <a href="#admin"  class="tab-btn active" aria-current="page">
    ⬡ Rebuild <span class="tab-badge rebuild">PRIMARY</span>
  </a>
  <a href="#legacy" class="tab-btn" aria-current="false">
    ◈ Legacy <span class="tab-badge legacy">ADVISOR</span>
  </a>
  <a href="#services" class="tab-btn" aria-current="false">
    ⬢ Services <span class="tab-badge services">GUIDE</span>
  </a>
</nav>`;

export class AdminUI {
  constructor(container, user) {
    this.container = container;
    this.user = user;
    this.proposal = null;
  }

  render() {
    this.container.innerHTML = TAB_NAV + `
      <div class="admin-dashboard">
        <header class="admin-header glass-panel">
          <div class="header-content">
            <h1>Heady™ Mission Control</h1>
            <div class="user-info">
              <span>Operative: ${this.user.email}</span>
              <button id="logout-btn" class="secondary-btn small">Disconnect</button>
            </div>
          </div>
        </header>

        <heady-live-status></heady-live-status>

        <main class="dashboard-grid">
          <section class="card glass-panel" id="system-status">
            <h2>System Coherence</h2>
            <div class="status-indicator">loading…</div>
            <p>Reading the System Map…</p>
          </section>

          <section class="card glass-panel" id="vars-card">
            <h2>Variable Registry</h2>
            <div class="status-indicator">loading…</div>
            <p>—</p>
          </section>

          <section class="card glass-panel" id="decomp-card">
            <h2>Legacy Decomposition</h2>
            <div class="status-indicator">loading…</div>
            <p>—</p>
          </section>

          <section class="card glass-panel" id="console-honeycomb-panel" style="grid-column: 1 / -1;">
            <h2>MCP Console <span class="muted">— the living honeycomb; every cell reports its measured state (§8)</span></h2>
            <heady-console-honeycomb></heady-console-honeycomb>
          </section>

          <section class="card glass-panel" id="build-narrative-panel" style="grid-column: 1 / -1;">
            <h2>Build Narrative <span class="muted">— live story of every build, via HeadyLens (ADR-0026 SSE)</span></h2>
            <heady-build-narrative id="build-narrative" subject="heady.action.build." detail="forensic"></heady-build-narrative>
          </section>

          <section class="card glass-panel codeflow-panel" style="grid-column: 1 / -1;">
            <h2>Governed Codeflow <span class="muted">— every change is a proposal (ADR-0005)</span></h2>
            <div class="cf-browse">
              <input id="cf-path" placeholder="docs" />
              <button type="button" id="cf-browse-btn" class="secondary-btn small">Browse</button>
              <button type="button" id="cf-load-btn" class="secondary-btn small">Load into editor</button>
              <div id="cf-tree" class="muted"></div>
            </div>
            <form id="cf-form">
              <div class="input-group"><label>Intent</label><input id="cf-intent" placeholder="what &amp; why" required /></div>
              <div class="input-group"><label>Target file (repo-relative)</label><input id="cf-target" placeholder="docs/example.md" required /></div>
              <div class="input-group"><label>Proposed content</label><textarea id="cf-content" rows="4" placeholder="full file content"></textarea></div>
              <button type="submit" class="primary-btn">Submit &amp; Validate</button>
            </form>
            <div id="cf-result"></div>
          </section>
        </main>
      </div>`;

    this.container.querySelector('#logout-btn').addEventListener('click', () => signOut(auth));
    this.container.querySelector('#cf-form').addEventListener('submit', (e) => this.onSubmit(e));
    this.container.querySelector('#cf-browse-btn').addEventListener('click', () => this.browse());
    this.container.querySelector('#cf-load-btn').addEventListener('click', () => this.loadFile());
    // Hand the narrative component an auth-token getter so it can open the
    // Bearer-authed HeadyLens SSE stream without coupling to firebase directly.
    const narrative = this.container.querySelector('#build-narrative');
    if (narrative) narrative.tokenProvider = () => this.token();
    window.dispatchEvent(new CustomEvent('navigation:admin:entered'));
    this.loadStatus();
  }

  async browse() {
    const tree = this.container.querySelector('#cf-tree');
    try {
      const r = await api.files(this.container.querySelector('#cf-path').value, await this.token());
      if (r.type === 'file') { tree.textContent = `${r.path} (${r.content.length} bytes) — use "Load into editor"`; return; }
      tree.innerHTML = r.entries.map((e) => `<a href="#" data-p="${r.path === '.' ? '' : r.path + '/'}${e.name}">${e.type === 'dir' ? '📁' : '📄'} ${e.name}</a>`).join(' ');
      tree.querySelectorAll('a').forEach((a) => a.addEventListener('click', (ev) => { ev.preventDefault(); this.container.querySelector('#cf-path').value = a.dataset.p; this.browse(); }));
    } catch (err) { tree.textContent = `cannot browse: ${err.message}`; }
  }

  async loadFile() {
    try {
      const r = await api.files(this.container.querySelector('#cf-path').value, await this.token());
      if (r.type !== 'file') { this.container.querySelector('#cf-tree').textContent = 'select a file, not a directory'; return; }
      this.container.querySelector('#cf-target').value = r.path;
      this.container.querySelector('#cf-content').value = r.content;
    } catch (err) { this.container.querySelector('#cf-tree').textContent = `cannot load: ${err.message}`; }
  }

  async loadStatus() {
    try {
      const s = await api.status();
      const coh = s.coherence;
      this.setCard('#system-status', coh ? (coh.gate === 'GREEN' ? 'online' : 'alert') : 'offline',
        coh ? `Gate ${coh.gate} · ${coh.contradictions} contradictions · ${coh.incomplete} incomplete` : 'kernel not yet run');
      const v = s.variables;
      this.setCard('#vars-card', v ? 'online' : 'offline',
        v ? `${v.total} variables · ${Object.entries(v.classes).map(([k, n]) => `${n} ${k}`).join(' · ')}` : 'registry not generated');
      const d = s.decomposition;
      this.setCard('#decomp-card', d ? 'online' : 'offline',
        d ? `${d.components} components · ${d.bundled}/${d.groups} groups bundled` : 'decomposition not generated');
    } catch (err) {
      this.setCard('#system-status', 'offline', `API unreachable: ${err.message}. Set VITE_CODEFLOW_API.`);
    }
  }

  setCard(sel, state, text) {
    const el = this.container.querySelector(sel);
    if (!el) return;
    const ind = el.querySelector('.status-indicator');
    ind.className = `status-indicator ${state}`;
    ind.textContent = state === 'online' ? 'Live' : state === 'alert' ? 'Attention' : 'Offline';
    el.querySelector('p').textContent = text;
  }

  async token() { try { return await this.user.getIdToken(); } catch { return ''; } }

  async onSubmit(e) {
    e.preventDefault();
    const out = this.container.querySelector('#cf-result');
    const intent = this.container.querySelector('#cf-intent').value;
    const targetFile = this.container.querySelector('#cf-target').value;
    const content = this.container.querySelector('#cf-content').value;
    out.innerHTML = '<p class="muted">Validating…</p>';
    try {
      const tok = await this.token();
      const submitted = await api.submit({ actor: this.user.email, intent, targetFile, content }, tok);
      const evaluated = await api.evaluate(submitted.id, tok);
      this.proposal = evaluated;
      this.renderResult(evaluated);
    } catch (err) {
      out.innerHTML = `<p class="status-indicator offline">Error: ${err.message}</p>`;
    }
  }

  renderResult(p) {
    const out = this.container.querySelector('#cf-result');
    const verdict = p.validation?.verdict || '—';
    const findings = (p.validation?.findings || []).map((f) => `<li><code>${f.rule}</code> — ${f.message}</li>`).join('');
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const diff = p.diffStat
      ? `<p class="muted">diff: +${p.diffStat.added} / −${p.diffStat.removed} ${p.diffStat.existed ? '' : '(new file)'}</p>
         <pre class="cf-diff">${(p.diffPreview || []).map((d) => `<span class="d${d.op === '+' ? 'add' : d.op === '-' ? 'del' : 'ctx'}">${d.op} ${esc(d.line)}</span>`).join('\n')}</pre>`
      : '';
    let actions = '';
    if (p.state === 'governance_pending') actions = `<button class="primary-btn" id="cf-approve">Approve as ${this.user.email} (human)</button>`;
    else if (p.state === 'approved') actions = `<button class="primary-btn" id="cf-apply">Apply</button>`;
    else if (p.state === 'applied') actions = `<button class="secondary-btn" id="cf-rollback">Rollback</button>`;
    out.innerHTML = `
      <div class="cf-verdict glass-panel">
        <p><strong>State:</strong> <code>${p.state}</code> · <strong>Validation:</strong> <code>${verdict}</code> · <strong>trace:</strong> ${p.traceId}</p>
        ${p.sensitive ? '<p class="status-indicator alert">Sensitive path — human approval required (no self-approve)</p>' : ''}
        ${findings ? `<ul class="cf-findings">${findings}</ul>` : ''}
        ${diff}
        <div class="cf-actions">${actions}</div>
      </div>`;
    const run = (fn) => async () => { try { this.proposal = await fn(await this.token()); this.renderResult(this.proposal); } catch (err) { out.innerHTML = `<p class="status-indicator offline">${err.message}</p>`; } };
    out.querySelector('#cf-approve')?.addEventListener('click', run((t) => api.approve(this.proposal.id, { approver: this.user.email, human: true }, t)));
    out.querySelector('#cf-apply')?.addEventListener('click', run((t) => api.apply(this.proposal.id, t)));
    out.querySelector('#cf-rollback')?.addEventListener('click', run((t) => api.rollback(this.proposal.id, t)));
  }
}
