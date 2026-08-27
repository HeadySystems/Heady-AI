// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Scaffold Planner — AdminUI section v1.0.0                 ║
// ║  Two clear interfaces: Heady-AI (rebuild) and Heady-V1 (legacy).  ║
// ║  Accept / defer / replan each option; decisions persist locally;  ║
// ║  replan converses with HeadyBuddy (pluggable, honest when off).   ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Reads the single-source plan served at /scaffold-plan.json (emitted by `heady-scaffold sync` from
// configs/scaffold-plan.json). Decisions are a browser-local overlay (localStorage), mirroring the
// CLI's .data/scaffold/decisions.json overlay — the plan source is never mutated.

const PLAN_URL = '/scaffold-plan.json';
const STORE_KEY = 'heady.scaffold.decisions';
const BUDDY_URL = import.meta.env.VITE_HEADYBUDDY_URL ?? '';
// When set, decisions are SHARED with the CLI via the scaffold sync API; otherwise local-only.
const SCAFFOLD_API = import.meta.env.VITE_SCAFFOLD_API ?? '';
const ICON = { done: '✓', 'in-progress': '◐', pending: '○', deferred: '⏸', accepted: '✓', replan: '↻' };

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export class ScaffoldPlannerUI {
  constructor(container) {
    this.container = container;
    this.plan = null;
    this.build = 'heady-ai';
    this.decisions = {};
  }

  // Decisions are SHARED with the CLI when VITE_SCAFFOLD_API is set; else browser-local.
  async loadDecisions() {
    if (SCAFFOLD_API) {
      try { return (await (await fetch(`${SCAFFOLD_API}/api/scaffold/decisions`)).json()).decisions || {}; } catch { return {}; }
    }
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; }
  }
  async persist(id, rec) {
    if (SCAFFOLD_API) {
      try { await fetch(`${SCAFFOLD_API}/api/scaffold/decisions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, decision: rec.decision, note: rec.note }) }); } catch { /* keep local copy painted */ }
      return;
    }
    localStorage.setItem(STORE_KEY, JSON.stringify(this.decisions));
  }

  // Flatten a build (phased "ai" or flat "v1") into uniform rows — mirrors scaffold-planner/core.flattenBuild.
  rows() {
    const b = this.plan?.builds?.[this.build];
    if (!b) return { meta: null, rows: [] };
    const rows = [];
    for (const ph of b.phases ?? []) for (const o of ph.options ?? []) rows.push({ id: o.id, title: o.title, group: ph.label, state: o.status ?? 'pending', detail: o.detail ?? '', refs: o.refs ?? [] });
    for (const o of b.options ?? []) rows.push({ id: o.id, title: o.title, group: 'Legacy layer', state: o.disposition ?? '—', detail: o.detail ?? '', refs: o.refs ?? [] });
    return { meta: { label: b.label, root: b.root, summary: b.summary }, rows };
  }

  async render() {
    this.container.innerHTML = `
      <style>
        #scaffold-planner .scaffold-tabs { display: flex; gap: .5rem; margin: .5rem 0; }
        #scaffold-planner .scaffold-tabs button.active { outline: 2px solid currentColor; opacity: 1; }
        #scaffold-planner .scaffold-group { margin: 1rem 0 .25rem; opacity: .8; font-size: .9rem; text-transform: uppercase; letter-spacing: .05em; }
        #scaffold-planner .scaffold-opt { padding: .5rem .75rem; margin: .35rem 0; border-radius: .5rem; background: rgba(255,255,255,.04); }
        #scaffold-planner .scaffold-opt-head { display: flex; gap: .5rem; align-items: center; flex-wrap: wrap; }
        #scaffold-planner .scaffold-actions { display: flex; gap: .4rem; margin-top: .4rem; }
        #scaffold-planner .scaffold-decision { margin-left: auto; font-size: .8rem; padding: .1rem .4rem; border-radius: .4rem; background: rgba(255,255,255,.08); }
        #scaffold-planner .scaffold-decision.accepted { color: #4caf50; } #scaffold-planner .scaffold-decision.deferred { color: #9e9e9e; } #scaffold-planner .scaffold-decision.replan { color: #e91e8c; }
        #scaffold-planner .scaffold-buddy { display: flex; gap: .5rem; align-items: center; margin-top: .75rem; }
        #scaffold-planner .scaffold-buddy input { flex: 1; }
      </style>
      <section class="card glass-panel" id="scaffold-planner" style="grid-column: 1 / -1;">
        <h2>Scaffold Planner <span class="muted">— accept · defer · replan the rebuild plan</span></h2>
        <div class="scaffold-tabs">
          <button type="button" class="secondary-btn small" data-build="heady-ai">Heady-AI (rebuild)</button>
          <button type="button" class="secondary-btn small" data-build="heady-v1">Heady-V1 (legacy)</button>
        </div>
        <p class="scaffold-meta muted">loading plan…</p>
        <div class="scaffold-options"></div>
        <div class="scaffold-buddy">
          <input id="buddy-note" placeholder="replan note for HeadyBuddy…" />
          <span class="muted" id="buddy-status">${BUDDY_URL ? 'HeadyBuddy ready' : 'HeadyBuddy not connected (set VITE_HEADYBUDDY_URL)'}</span>
        </div>
      </section>`;

    this.container.querySelectorAll('.scaffold-tabs button').forEach((btn) =>
      btn.addEventListener('click', () => { this.build = btn.dataset.build; this.paint(); }));

    try {
      this.plan = await (await fetch(PLAN_URL)).json();
    } catch {
      this.container.querySelector('.scaffold-meta').textContent = 'plan unavailable — run `heady-scaffold sync`';
      return;
    }
    this.decisions = await this.loadDecisions();
    this.paint();
  }

  paint() {
    const { meta, rows } = this.rows();
    if (!meta) return;
    this.container.querySelectorAll('.scaffold-tabs button').forEach((b) =>
      b.classList.toggle('active', b.dataset.build === this.build));
    const counts = { pending: 0, accepted: 0, deferred: 0, replan: 0 };
    for (const r of rows) counts[this.decisions[r.id]?.decision ?? 'pending']++;
    this.container.querySelector('.scaffold-meta').innerHTML =
      `<strong>${esc(meta.label)}</strong> · <code>${esc(meta.root)}</code> — ${esc(meta.summary)}<br/>` +
      `${rows.length} options · ${counts.accepted} accepted · ${counts.deferred} deferred · ${counts.replan} replan · ${counts.pending} pending`;

    let group = null;
    const html = [];
    for (const r of rows) {
      if (r.group !== group) { group = r.group; html.push(`<h3 class="scaffold-group">${esc(group)}</h3>`); }
      const d = this.decisions[r.id]?.decision ?? 'pending';
      const note = this.decisions[r.id]?.note;
      html.push(`
        <div class="scaffold-opt" data-id="${esc(r.id)}">
          <div class="scaffold-opt-head">
            <span class="status-indicator ${r.state === 'done' ? 'online' : r.state === 'deferred' ? 'offline' : 'alert'}">${ICON[r.state] ?? '·'} ${esc(r.state)}</span>
            <strong>${esc(r.title)}</strong>
            <code class="muted">${esc(r.id)}</code>
            ${d !== 'pending' ? `<span class="scaffold-decision ${d}">${ICON[d]} ${d}${note ? `: ${esc(note)}` : ''}</span>` : ''}
          </div>
          ${r.detail ? `<p class="muted">${esc(r.detail)}</p>` : ''}
          <div class="scaffold-actions">
            <button type="button" class="secondary-btn small" data-act="accepted">Accept</button>
            <button type="button" class="secondary-btn small" data-act="deferred">Defer</button>
            <button type="button" class="secondary-btn small" data-act="replan">Replan</button>
          </div>
        </div>`);
    }
    this.container.querySelector('.scaffold-options').innerHTML = html.join('');
    this.container.querySelectorAll('.scaffold-opt').forEach((card) => {
      const id = card.dataset.id;
      card.querySelectorAll('[data-act]').forEach((btn) =>
        btn.addEventListener('click', () => this.decide(id, btn.dataset.act)));
    });
  }

  async decide(id, decision) {
    const note = decision === 'replan' ? (this.container.querySelector('#buddy-note').value || null) : null;
    const rec = { decision, note, at: new Date().toISOString() };
    this.decisions[id] = rec;
    this.paint();
    await this.persist(id, rec);
    if (decision === 'replan') await this.replan(id, note);
  }

  async replan(id, note) {
    const status = this.container.querySelector('#buddy-status');
    if (!BUDDY_URL) { status.textContent = `replan recorded locally for ${id} — HeadyBuddy not connected`; return; }
    status.textContent = 'asking HeadyBuddy…';
    try {
      const res = await fetch(BUDDY_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'scaffold.replan', build: this.build, optionId: id, note }),
      });
      const body = await res.json().catch(() => ({}));
      status.textContent = res.ok ? `HeadyBuddy: ${body.reply ?? 'received'}` : `HeadyBuddy HTTP ${res.status}`;
    } catch (err) {
      status.textContent = `HeadyBuddy unreachable (${err.message}); replan recorded locally`;
    }
  }
}
