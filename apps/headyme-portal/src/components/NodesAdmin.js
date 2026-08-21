// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Nodes Operations Console v1.0.0                         ║
// ║  Authenticated runtime, dispatch, audit, and maintenance UI.    ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder               ║
// ╚══════════════════════════════════════════════════════════════════╝

import { FIB, HEARTBEAT_MS } from '@heady/phi-math';
import { nodesApi } from '../services/heady-api.js';
import { auditDelivery, groupNodes, readinessTone, validateDispatch } from './nodes-admin-logic.mjs';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = String(text);
  return node;
}

function displayTime(value) {
  if (!value) return 'never observed';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'invalid timestamp' : date.toLocaleString();
}

export class NodesAdmin {
  constructor(container, user) {
    this.container = container;
    this.user = user;
    this.admin = false;
    this.registry = null;
    this.refreshTimer = null;
  }

  render() {
    this.container.innerHTML = `
      <div class="nodes-console-toolbar">
        <div>
          <p class="eyebrow">Production control plane</p>
          <h2>Nodes &amp; Orchestration</h2>
          <p class="muted">Measured runtime state from Neon, NATS, and the append-only task outbox.</p>
        </div>
        <div class="nodes-toolbar-actions">
          <span id="nodes-access" class="access-pill">Checking access…</span>
          <button type="button" id="nodes-refresh" class="secondary-btn small">Refresh</button>
        </div>
      </div>
      <div id="nodes-notice" class="operation-notice" role="status" aria-live="polite"></div>
      <div class="nodes-kpi-grid" id="nodes-kpis" aria-busy="true"></div>
      <section class="nodes-section">
        <div class="section-heading"><h3>Runtime topology</h3><span id="nodes-count" class="muted"></span></div>
        <div id="nodes-roster" class="node-groups"></div>
      </section>
      <div class="nodes-operations-grid">
        <section class="nodes-section operation-card">
          <h3>Dispatch governed task</h3>
          <p class="muted">Writes to Neon before NATS projection. Every submission has an idempotency key and trace ID.</p>
          <form id="node-dispatch-form">
            <label>Runtime or attribution role<select id="dispatch-node" required></select></label>
            <label>Action<input id="dispatch-action" value="inspect.health" required pattern="[a-z][a-z0-9._-]*" /></label>
            <label>Input JSON<textarea id="dispatch-input" rows="5">{}</textarea></label>
            <button type="submit" class="primary-btn">Dispatch task</button>
          </form>
          <div id="dispatch-result" class="operation-result" aria-live="polite"></div>
        </section>
        <section class="nodes-section operation-card">
          <h3>Track task</h3>
          <p class="muted">Retrieve durable task state and its outbox projection history.</p>
          <form id="task-lookup-form" class="inline-operation">
            <label>Task ID<input id="task-id" placeholder="UUID" required /></label>
            <button type="submit" class="secondary-btn">Look up</button>
          </form>
          <div id="task-result" class="operation-result" aria-live="polite"></div>
        </section>
      </div>
      <section class="nodes-section">
        <div class="section-heading">
          <div><h3>Append-only audit trail</h3><p class="muted" id="audit-authority">Neon task outbox</p></div>
          <label class="compact-field">Filter node<select id="audit-node"><option value="">All nodes</option></select></label>
        </div>
        <div class="audit-table-wrap"><table class="admin-table"><thead><tr><th>Sequence</th><th>Task</th><th>Subject</th><th>Status</th><th>Delivery</th><th>Created</th></tr></thead><tbody id="audit-body"></tbody></table></div>
      </section>`;

    this.container.querySelector('#nodes-refresh').addEventListener('click', () => this.refresh());
    this.container.querySelector('#node-dispatch-form').addEventListener('submit', (event) => this.dispatch(event));
    this.container.querySelector('#task-lookup-form').addEventListener('submit', (event) => this.lookupTask(event));
    this.container.querySelector('#audit-node').addEventListener('change', () => this.loadAudit());
    this.authorizeAndLoad();
  }

  async token() {
    return this.user.getIdToken();
  }

  async authorizeAndLoad() {
    const access = this.container.querySelector('#nodes-access');
    try {
      const tokenResult = await this.user.getIdTokenResult();
      this.admin = tokenResult.claims.admin === true;
      access.textContent = this.admin ? 'Admin verified' : 'Read-only account';
      access.className = `access-pill ${this.admin ? 'online' : 'alert'}`;
      this.setPrivilegedControls(this.admin);
      if (!this.admin) this.notice('Your Firebase account can view system state but needs the admin custom claim to dispatch tasks or read the audit ledger.', 'alert');
      await this.refresh();
      this.refreshTimer = window.setInterval(() => this.refresh({ quiet: true }), HEARTBEAT_MS);
    } catch (error) {
      access.textContent = 'Access check failed';
      access.className = 'access-pill offline';
      this.setPrivilegedControls(false);
      this.notice(error.message, 'offline');
    }
  }

  setPrivilegedControls(enabled) {
    for (const target of this.container.querySelectorAll('#node-dispatch-form input, #node-dispatch-form textarea, #node-dispatch-form select, #node-dispatch-form button, #task-lookup-form input, #task-lookup-form button, #audit-node')) {
      target.disabled = !enabled;
    }
  }

  async refresh({ quiet = false } = {}) {
    const refresh = this.container.querySelector('#nodes-refresh');
    refresh.disabled = true;
    if (!quiet) this.notice('Refreshing measured state…', 'loading');
    try {
      const token = await this.token();
      const [registry, readiness, maintenance] = await Promise.all([
        nodesApi.registry(token),
        nodesApi.readiness(token),
        nodesApi.maintenance(token),
      ]);
      this.registry = registry;
      this.renderKpis(registry, readiness, maintenance);
      this.renderRoster(registry.nodes);
      this.populateSelectors(registry);
      if (this.admin) await this.loadAudit(token);
      if (!quiet) this.notice(`State refreshed · ${new Date().toLocaleTimeString()}`, readinessTone(readiness));
    } catch (error) {
      this.notice(`Refresh failed: ${error.message}`, 'offline');
    } finally {
      refresh.disabled = false;
      this.container.querySelector('#nodes-kpis').setAttribute('aria-busy', 'false');
    }
  }

  renderKpis(registry, readiness, maintenance) {
    const kpis = [
      ['Production', readiness.productionReady ? 'READY' : 'BLOCKED', readinessTone(readiness), readiness.blockers?.join(' · ') || 'All readiness gates satisfied'],
      ['Runtime nodes', `${registry.active}/${registry.total}`, registry.active > 0 ? 'online' : 'alert', 'Fresh READY heartbeats / registered contexts'],
      ['NATS transport', readiness.eventTransport?.ready ? 'READY' : 'UNAVAILABLE', readiness.eventTransport?.ready ? 'online' : 'offline', readiness.eventTransport?.name || 'No transport reported'],
      ['Audit integrity', readiness.auditAppendOnlyEnforced ? 'ENFORCED' : 'UNVERIFIED', readiness.auditAppendOnlyEnforced ? 'online' : 'offline', readiness.authoritativeAudit || 'No authority reported'],
      ['Filesystem', maintenance.filesystem?.localMutationEnabled === false ? 'READ ONLY' : 'UNSAFE', maintenance.filesystem?.localMutationEnabled === false ? 'online' : 'offline', maintenance.filesystem?.cleanupStrategy || 'No policy reported'],
    ];
    const root = this.container.querySelector('#nodes-kpis');
    root.replaceChildren(...kpis.map(([label, value, tone, detail]) => {
      const card = element('article', `nodes-kpi ${tone}`);
      card.append(element('span', 'kpi-label', label), element('strong', null, value), element('small', null, detail));
      return card;
    }));
  }

  renderRoster(nodes) {
    const root = this.container.querySelector('#nodes-roster');
    const groups = groupNodes(nodes);
    const fragments = Object.entries(groups).map(([group, members]) => {
      const section = element('section', 'node-group');
      const heading = element('div', 'node-group-heading');
      heading.append(element('h4', null, group), element('span', 'muted', `${members.filter(({ live }) => live).length}/${members.length} live`));
      const grid = element('div', 'node-card-grid');
      for (const node of members) {
        const card = element('article', `node-card ${node.live ? 'online' : node.heartbeat ? 'alert' : 'offline'}`);
        const title = element('div', 'node-card-title');
        title.append(element('strong', null, node.id.replace('HEADY_', '')), element('span', 'node-state', node.heartbeat?.status || 'UNOBSERVED'));
        card.append(title, element('p', null, node.responsibility), element('small', null, node.heartbeat ? `${node.heartbeat.revision} · ${displayTime(node.heartbeat.observedAt)}` : 'No measured heartbeat'));
        grid.append(card);
      }
      section.append(heading, grid);
      return section;
    });
    root.replaceChildren(...fragments);
    this.container.querySelector('#nodes-count').textContent = `${nodes.filter(({ live }) => live).length} live · ${nodes.length} registered`;
  }

  populateSelectors(registry) {
    const dispatch = this.container.querySelector('#dispatch-node');
    const audit = this.container.querySelector('#audit-node');
    if (dispatch.options.length === 0) {
      dispatch.append(new Option('Select node or role', ''));
      for (const node of registry.nodes) dispatch.append(new Option(`${node.id} — ${node.responsibility}`, node.id));
      for (const role of registry.attributionRoles) dispatch.append(new Option(`${role.id} role → ${role.runtimeNode}`, role.id));
    }
    if (audit.options.length === 1) {
      for (const node of registry.nodes) audit.append(new Option(node.id, node.id));
    }
    this.setPrivilegedControls(this.admin);
  }

  async loadAudit(existingToken) {
    if (!this.admin) return;
    const body = this.container.querySelector('#audit-body');
    body.replaceChildren();
    try {
      const token = existingToken || await this.token();
      const node = this.container.querySelector('#audit-node').value;
      const audit = await nodesApi.audit(token, { limit: FIB[8], node });
      this.container.querySelector('#audit-authority').textContent = `${audit.authority} · append-only ${audit.appendOnlyEnforced ? 'enforced' : 'not verified'}`;
      for (const event of audit.events || []) {
        const row = document.createElement('tr');
        const values = [event.seq, event.task_id, event.topic, event.status, auditDelivery(event), displayTime(event.created_at)];
        for (const value of values) row.append(element('td', null, value));
        body.append(row);
      }
      if (!body.children.length) {
        const row = document.createElement('tr');
        const cell = element('td', 'empty-table', 'No node audit events match this filter.');
        cell.colSpan = FIB[6];
        row.append(cell);
        body.append(row);
      }
    } catch (error) {
      const row = document.createElement('tr');
      const cell = element('td', 'empty-table error-message', `Audit unavailable: ${error.message}`);
      cell.colSpan = FIB[6];
      row.append(cell);
      body.append(row);
    }
  }

  async dispatch(event) {
    event.preventDefault();
    const output = this.container.querySelector('#dispatch-result');
    try {
      const request = validateDispatch({
        nodeId: this.container.querySelector('#dispatch-node').value,
        action: this.container.querySelector('#dispatch-action').value,
        inputText: this.container.querySelector('#dispatch-input').value,
      });
      output.textContent = 'Committing task to Neon…';
      const task = await nodesApi.dispatch(request.nodeId, request.body, await this.token(), {
        idempotencyKey: `admin-${crypto.randomUUID()}`,
        traceId: crypto.randomUUID(),
      });
      output.textContent = `Accepted ${task.taskId} · ${task.status}${task.deduplicated ? ' · deduplicated' : ''}`;
      this.container.querySelector('#task-id').value = task.taskId;
      await this.loadAudit();
    } catch (error) {
      output.textContent = `Dispatch failed: ${error.message}`;
    }
  }

  async lookupTask(event) {
    event.preventDefault();
    const output = this.container.querySelector('#task-result');
    try {
      const task = await nodesApi.task(this.container.querySelector('#task-id').value.trim(), await this.token());
      output.replaceChildren(
        element('strong', null, `${task.status} · ${task.kind}`),
        element('p', 'muted', `Created ${displayTime(task.created_at)} · updated ${displayTime(task.updated_at)}`),
        element('p', 'muted', `${task.audit?.length || 0} outbox event(s)`),
      );
    } catch (error) {
      output.textContent = `Lookup failed: ${error.message}`;
    }
  }

  notice(message, tone) {
    const notice = this.container.querySelector('#nodes-notice');
    notice.className = `operation-notice ${tone}`;
    notice.textContent = message;
  }

  destroy() {
    if (this.refreshTimer) window.clearInterval(this.refreshTimer);
    this.refreshTimer = null;
  }
}
