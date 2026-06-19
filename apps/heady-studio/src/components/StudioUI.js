// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Studio — Workspace                                        ║
// ║  The Claude-Code-style host surface: model/mode/effort/execution   ║
// ║  controls, a Services panel (Heady services + external MCP), skills  ║
// ║  & workflows, a live recommendation strip, a billing meter, and an   ║
// ║  auto-growing composer. Every control is rendered from the manifest  ║
// ║  so new options appear with zero UI changes.                        ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝
import { signOut, auth, idToken } from '../services/firebase.js';
import { fetchManifest, estimate, MCP_ENDPOINT } from '../services/gateway.js';
import { HeadyMcpHost } from '../services/mcp-host.js';
import { buildManifest, estimateBilling, recommend, EXTERNAL_MCP_PRESETS } from '@heady/studio-registry';

const COMPOSER_MAX_ROWS = 6;          // grow to ~6 lines, then scroll (user spec)
const RECOMMEND_DEBOUNCE_MS = 233;    // FIB(13)ms — φ-derived, no magic number

export class StudioUI {
  constructor(root, user) {
    this.root = root;
    this.user = user;
    this.host = new HeadyMcpHost(idToken);
    this.manifest = buildManifest(); // local default; replaced by server manifest on init
    this.messages = [];
    this.recommendations = [];
    this._recTimer = null;
    this.selection = {
      model: this._defaultId('models'),
      mode: 'understanding',
      effort: this._defaultId('effort'),
      exec: this._defaultId('executionModes', 'testing-review'),
      skills: new Set(),
      workflows: new Set(),
      headyServices: new Set(this.manifest.headyServices.filter((s) => s.permanent || s.default).map((s) => s.id)),
      externalMcp: new Set(this.manifest.externalMcp.filter((m) => m.default).map((m) => m.id)),
    };
  }

  _defaultId(key, fallback) {
    const list = this.manifest[key] ?? [];
    return (list.find((x) => x.default) ?? list[0])?.id ?? fallback;
  }

  // ── lifecycle ─────────────────────────────────────────────────────
  render() {
    this.root.innerHTML = `
      <div class="studio">
        <aside class="sidebar" aria-label="Services and tools">
          <header class="sidebar-head">
            <span class="brand-mark" aria-hidden="true">∞</span>
            <strong>Heady Studio</strong>
          </header>
          <div id="conn-status" class="conn-status" role="status">Connecting to headymcp.com…</div>
          <div id="panels"></div>
        </aside>
        <main class="workspace">
          <div class="topbar" id="topbar"></div>
          <div class="transcript" id="transcript" aria-live="polite"></div>
          <div class="recommend-strip" id="recommend" aria-label="Recommendations"></div>
          <form class="composer" id="composer">
            <button type="button" class="btn-attach" id="attach-btn" title="Attach files" aria-label="Attach files">📎</button>
            <textarea id="composer-input" rows="1" placeholder="Ask Heady, connect a repo, or pick a mode…" aria-label="Message"></textarea>
            <input type="file" id="attach-input" multiple hidden />
            <button type="submit" class="btn-send" id="send-btn">Send</button>
          </form>
          <div class="composer-meta" id="composer-meta"></div>
        </main>
      </div>`;

    this._renderTopbar();
    this._renderPanels();
    this._renderRecommendations();
    this._wireComposer();
    this._updateBilling();
    this._init();
  }

  async _init() {
    // Connect to Heady's multiplexed gateway and prefer its authoritative manifest.
    try {
      await this.host.connectHeady(MCP_ENDPOINT);
      this._setConn(`Connected · headymcp.com (${this.host.connections.get('heady')?.tools.length ?? 0} tools)`);
    } catch (err) {
      this._setConn(`Offline · ${String(err?.message ?? err)}`, true);
    }
    try {
      this.manifest = await fetchManifest();
      this._renderTopbar();
      this._renderPanels();
    } catch { /* keep local manifest; UI already rendered */ }
    // Connect any external MCP servers toggled on by default (those with a URL).
    for (const id of this.selection.externalMcp) this._connectExternal(id).catch(() => {});
    this._refreshRecommendations('');
  }

  destroy() { this.host.disconnectAll().catch(() => {}); if (this._recTimer) clearTimeout(this._recTimer); }

  // ── topbar: model / mode / effort / execution / billing / sign-out ──
  _renderTopbar() {
    const sel = this.selection;
    const opts = (list, cur) => list.map((x) => `<option value="${x.id}" ${x.id === cur ? 'selected' : ''}>${x.label}</option>`).join('');
    const segmented = (list, cur, name) => list.map((x) =>
      `<button type="button" class="seg ${x.id === cur ? 'on' : ''}" data-${name}="${x.id}" title="${x.description ?? ''}">${x.glyph ? x.glyph + ' ' : ''}${x.label}</button>`).join('');

    const bar = this.root.querySelector('#topbar');
    bar.innerHTML = `
      <div class="ctl"><label for="model-sel">Model</label>
        <select id="model-sel">${opts(this.manifest.models, sel.model)}</select></div>
      <div class="ctl"><label>Mode</label><div class="segmented" id="mode-seg">${segmented(this.manifest.modes, sel.mode, 'mode')}</div></div>
      <div class="ctl"><label for="effort-sel">Effort</label>
        <select id="effort-sel">${opts(this.manifest.effort, sel.effort)}</select></div>
      <div class="ctl"><label>Run</label><div class="segmented" id="exec-seg">${segmented(this.manifest.executionModes, sel.exec, 'exec')}</div></div>
      <div class="spacer"></div>
      <div class="meter" id="meter" title="Per-message credits — toggling features adjusts this"></div>
      <button class="btn-link" id="signout">Sign out (${this.user.email ?? 'user'})</button>`;

    bar.querySelector('#model-sel').addEventListener('change', (e) => { sel.model = e.target.value; this._updateBilling(); });
    bar.querySelector('#effort-sel').addEventListener('change', (e) => { sel.effort = e.target.value; this._updateBilling(); });
    bar.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => { sel.mode = b.dataset.mode; this._renderTopbar(); this._updateBilling(); this._refreshRecommendations(this._inputValue()); }));
    bar.querySelectorAll('[data-exec]').forEach((b) => b.addEventListener('click', () => { sel.exec = b.dataset.exec; this._renderTopbar(); }));
    bar.querySelector('#signout').addEventListener('click', () => signOut(auth));
  }

  // ── sidebar panels: services / external MCP / skills / workflows / repos ──
  _renderPanels() {
    const sel = this.selection;
    const toggleRow = (item, on, opts = {}) => `
      <label class="toggle ${opts.locked ? 'locked' : ''}">
        <input type="checkbox" data-kind="${opts.kind}" data-id="${item.id}" ${on ? 'checked' : ''} ${opts.locked ? 'disabled' : ''} />
        <span>${item.label}</span>
        ${opts.locked ? '<em class="tag">always on</em>' : (item.creditWeight ? `<em class="tag">${item.creditWeight}c</em>` : '')}
      </label>`;

    const headySvc = this.manifest.headyServices.map((s) =>
      toggleRow(s, sel.headyServices.has(s.id) || s.permanent, { kind: 'heady', locked: s.permanent })).join('');
    const extMcp = this.manifest.externalMcp.map((m) =>
      toggleRow(m, sel.externalMcp.has(m.id), { kind: 'mcp' })).join('');
    const skills = this.manifest.skills.map((s) => toggleRow(s, sel.skills.has(s.id), { kind: 'skill' })).join('');
    const flows = this.manifest.workflows.map((w) => toggleRow(w, sel.workflows.has(w.id), { kind: 'workflow' })).join('');
    const repos = (this.manifest.repoConnectors ?? []).map((r) =>
      `<button type="button" class="repo-btn" data-repo="${r.id}">${r.label}</button>`).join('');

    this.root.querySelector('#panels').innerHTML = `
      ${this._panel('Heady services', headySvc)}
      ${this._panel('External MCP servers', extMcp + `<button type="button" class="add-mcp" id="add-mcp">+ Add by URL (…/mcp)</button>`)}
      ${this._panel('Skills', skills)}
      ${this._panel('Workflows', flows)}
      ${this._panel('Connect a repo', `<div class="repo-list">${repos}</div>`)}`;

    this.root.querySelectorAll('#panels input[type=checkbox]').forEach((cb) =>
      cb.addEventListener('change', () => this._onToggle(cb.dataset.kind, cb.dataset.id, cb.checked)));
    this.root.querySelector('#add-mcp')?.addEventListener('click', () => this._addExternalByUrl());
    this.root.querySelectorAll('[data-repo]').forEach((b) =>
      b.addEventListener('click', () => this._connectRepo(b.dataset.repo)));
  }

  _panel(title, inner) {
    return `<details class="panel" open><summary>${title}</summary><div class="panel-body">${inner}</div></details>`;
  }

  _onToggle(kind, id, on) {
    const map = { heady: 'headyServices', mcp: 'externalMcp', skill: 'skills', workflow: 'workflows' };
    const set = this.selection[map[kind]];
    if (on) set.add(id); else set.delete(id);
    if (kind === 'mcp') { on ? this._connectExternal(id).catch((e) => this._sysMsg(`Could not connect ${id}: ${e.message}`)) : this.host.disconnect(id); }
    this._updateBilling();
  }

  // ── external MCP connection (Heady's /mcp convention for any server) ──
  async _connectExternal(id) {
    const preset = EXTERNAL_MCP_PRESETS.find((p) => p.id === id);
    const url = preset && import.meta.env[preset.urlEnv];
    if (!url) { this._sysMsg(`${id}: no endpoint configured (set ${preset?.urlEnv ?? 'its URL'}); skipping connect.`); return; }
    await this.host.connect(id, url);
    this._sysMsg(`Connected external MCP server: ${id}`);
  }

  _addExternalByUrl() {
    const url = window.prompt('External MCP server endpoint (Streamable-HTTP, conventionally …/mcp):');
    if (!url) return;
    let parsed; try { parsed = new URL(url); } catch { this._sysMsg('Invalid URL.'); return; }
    const id = parsed.host;
    this.host.connect(id, parsed.href)
      .then(() => { this.selection.externalMcp.add(id); this._sysMsg(`Connected ${id}.`); this._updateBilling(); })
      .catch((e) => this._sysMsg(`Could not connect ${id}: ${e.message}`));
  }

  _connectRepo(repoId) {
    // Repos are reached through MCP servers (github-mcp / filesystem-mcp). The
    // skeleton routes the intent to the host; binding the server provides tools.
    const connector = (this.manifest.repoConnectors ?? []).find((r) => r.id === repoId);
    this._sysMsg(`Repo connector "${connector?.label ?? repoId}" routes through the ${connector?.via ?? 'mcp'} server. Toggle it on under External MCP servers to expose its tools.`);
  }

  // ── composer (auto-grow to 6 lines, then scroll) + attach + send ────
  _wireComposer() {
    const form = this.root.querySelector('#composer');
    this.input = this.root.querySelector('#composer-input');
    const fileInput = this.root.querySelector('#attach-input');

    this._autosize();
    this.input.addEventListener('input', () => { this._autosize(); this._scheduleRecommend(); });
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
    });
    form.addEventListener('submit', (e) => { e.preventDefault(); this._send(); });
    this.root.querySelector('#attach-btn').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const names = [...fileInput.files].map((f) => f.name);
      if (names.length) this._sysMsg(`Attached: ${names.join(', ')}`);
    });
  }

  _autosize() {
    const ta = this.input;
    ta.style.height = 'auto';
    const line = parseFloat(getComputedStyle(ta).lineHeight) || 20;
    const max = line * COMPOSER_MAX_ROWS;
    ta.style.height = `${Math.min(ta.scrollHeight, max)}px`;
    ta.style.overflowY = ta.scrollHeight > max ? 'auto' : 'hidden';
  }

  _inputValue() { return this.input?.value ?? ''; }

  // ── recommendation engine ───────────────────────────────────────────
  _scheduleRecommend() {
    if (this._recTimer) clearTimeout(this._recTimer);
    this._recTimer = setTimeout(() => this._refreshRecommendations(this._inputValue()), RECOMMEND_DEBOUNCE_MS);
  }

  async _refreshRecommendations(input) {
    // Instant local pass for responsiveness…
    this.recommendations = recommend({ input, mode: this.selection.mode });
    this._renderRecommendations();
    // …then reconcile with the gateway's engine when connected (authoritative).
    if (this.host.isConnected('heady')) {
      try {
        const res = await this.host.callTool('heady', 'heady_recommend', { input, mode: this.selection.mode });
        const text = res.content?.find((c) => c.type === 'text')?.text;
        if (text) { const parsed = JSON.parse(text); if (Array.isArray(parsed.recommendations)) { this.recommendations = parsed.recommendations; this._renderRecommendations(); } }
      } catch { /* keep local recommendations */ }
    }
  }

  _renderRecommendations() {
    const el = this.root.querySelector('#recommend');
    if (!el) return;
    if (!this.recommendations.length) { el.innerHTML = ''; return; }
    el.innerHTML = `<span class="rec-label">Suggestions</span>` + this.recommendations
      .map((r) => `<button type="button" class="rec-chip" data-rec="${r.id}" data-kind="${r.kind}">${r.label}</button>`).join('');
    el.querySelectorAll('[data-rec]').forEach((c) => c.addEventListener('click', () => this._applyRecommendation(c.dataset.rec, c.dataset.kind)));
  }

  _applyRecommendation(id, kind) {
    if (id === 'enable-deep-research') { this.selection.mode = 'deep-research'; this._renderTopbar(); }
    else if (id === 'enable-memory') { this.selection.headyServices.add('memory'); this._renderPanels(); }
    else if (id === 'use-sandbox') { this.selection.exec = 'sandbox'; this._renderTopbar(); }
    else if (id === 'run-security-audit') { this.selection.skills.add('heady-security-audit'); this._renderPanels(); }
    else if (id === 'connect-github') { this.selection.externalMcp.add('github'); this._renderPanels(); this._connectExternal('github').catch(() => {}); }
    else if (id === 'decompose-task') { this.selection.skills.add('heady-task-decomposition'); this._renderPanels(); }
    this._updateBilling();
    this._sysMsg(`Applied suggestion: ${id}`);
  }

  // ── billing meter (local instant + server reconcile) ────────────────
  _selectionPayload() {
    const s = this.selection;
    return { model: s.model, mode: s.mode, effort: s.effort, skills: [...s.skills], workflows: [...s.workflows], headyServices: [...s.headyServices], externalMcp: [...s.externalMcp] };
  }

  _updateBilling() {
    const local = estimateBilling(this._selectionPayload());
    const meter = this.root.querySelector('#meter');
    if (meter) meter.textContent = `≈ ${local.total} ${local.currency}/msg`;
    estimate(this._selectionPayload())
      .then((srv) => { if (meter) meter.textContent = `${srv.total} ${srv.currency}/msg`; })
      .catch(() => { /* keep local estimate */ });
  }

  // ── transcript + send ───────────────────────────────────────────────
  _renderTranscript() {
    const t = this.root.querySelector('#transcript');
    t.innerHTML = this.messages.map((m) =>
      `<div class="msg ${m.role}"><div class="msg-role">${m.role}</div><div class="msg-body">${this._escape(m.text)}</div></div>`).join('');
    t.scrollTop = t.scrollHeight;
  }

  _sysMsg(text) { this.messages.push({ role: 'system', text }); this._renderTranscript(); }
  _escape(s) { return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

  async _send() {
    const text = this.input.value.trim();
    if (!text) return;
    this.messages.push({ role: 'user', text });
    this.input.value = ''; this._autosize();
    this._renderTranscript();

    const s = this.selection;
    // Honest context envelope — proves the selection + MCP wiring is live.
    const envelope = [
      `model=${s.model}`, `mode=${s.mode}`, `effort=${s.effort}`, `run=${s.exec}`,
      `heady=[${[...s.headyServices].join(',')}]`, `mcp=[${[...s.externalMcp].join(',')}]`,
    ].join(' · ');

    if (s.mode === 'recommendation' && this.host.isConnected('heady')) {
      try {
        const res = await this.host.callTool('heady', 'heady_recommend', { input: text, mode: s.mode });
        const out = res.content?.find((c) => c.type === 'text')?.text ?? '{}';
        this.messages.push({ role: 'assistant', text: `Recommendation engine →\n${out}\n\n[${envelope}]` });
      } catch (e) { this.messages.push({ role: 'assistant', text: `Recommendation call failed: ${e.message}` }); }
    } else if (this.host.isConnected('heady')) {
      this.messages.push({ role: 'assistant', text: `Received under [${envelope}]. Model-backed reasoning streams here once the selected model's provider key is injected into the gateway; MCP tools are live now (try Recommendation mode).` });
    } else {
      this.messages.push({ role: 'assistant', text: `Not connected to headymcp.com yet — check the connection status. [${envelope}]` });
    }
    this._renderTranscript();
    this._refreshRecommendations('');
  }

  _setConn(text, isError = false) {
    const el = this.root.querySelector('#conn-status');
    if (el) { el.textContent = text; el.classList.toggle('error', isError); }
  }
}
