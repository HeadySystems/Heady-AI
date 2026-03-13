/**
 * ═══════════════════════════════════════════════════════════════
 *  HEADY WEB — Dashboard Application
 *  Connects to HeadyManager API at /api/*
 * ═══════════════════════════════════════════════════════════════
 */

const H = {
  // ── API Client ──────────────────────────────────────────────
  async api(path, opts = {}) {
    try {
      const res = await fetch(`/api${path}`, {
        headers: { 'Content-Type': 'application/json', ...opts.headers },
        ...opts,
      });
      return await res.json();
    } catch (err) {
      console.warn(`API ${path}:`, err.message);
      return { ok: false, error: err.message };
    }
  },

  async get(path) { return this.api(path); },
  async post(path, body) {
    return this.api(path, { method: 'POST', body: JSON.stringify(body) });
  },

  // ── State ───────────────────────────────────────────────────
  currentView: 'overview',
  chatHistory: [],
  pollTimers: [],
  healthData: null,
  nodesData: null,
  servicesData: null,

  // ── Init ────────────────────────────────────────────────────
  async init() {
    this.bindNav();
    this.startClock();
    this.showView('overview');

    // Initial data load
    await Promise.all([
      this.loadHealth(),
      this.loadSystemStatus(),
      this.loadNodes(),
      this.loadServices(),
      this.loadBuddySuggestions(),
      this.loadSwarms(),
      this.loadColab(),
    ]);

    // Live polling every 8s
    this.pollTimers.push(setInterval(() => this.loadHealth(), 8000));
    this.pollTimers.push(setInterval(() => this.loadSystemStatus(), 10000));
    this.pollTimers.push(setInterval(() => this.loadResources(), 8000));

    // Chat enter key
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendChat(); }
      });
    }
  },

  // ── Navigation ──────────────────────────────────────────────
  bindNav() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => this.showView(item.dataset.view));
    });
  },

  showView(viewId) {
    this.currentView = viewId;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector(`.nav-item[data-view="${viewId}"]`)?.classList.add('active');
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const view = document.getElementById(`view-${viewId}`);
    if (view) {
      view.classList.add('active');
      // Lazy-load view data
      if (viewId === 'resources') this.loadResources();
      if (viewId === 'pipeline') this.loadPipeline();
      if (viewId === 'registry') this.loadRegistry();
      if (viewId === 'nodes') this.loadNodes();
      if (viewId === 'services') this.loadServices();
      if (viewId === 'swarms') this.loadSwarms();
      if (viewId === 'colab') this.loadColab();
    }
  },

  // ── Clock ───────────────────────────────────────────────────
  startClock() {
    const update = () => {
      const el = document.getElementById('clock');
      if (el) el.textContent = new Date().toLocaleTimeString('en-US', { hour12: false });
    };
    update();
    setInterval(update, 1000);
  },

  // ── Health ──────────────────────────────────────────────────
  async loadHealth() {
    const data = await this.get('/health');
    this.healthData = data;
    const badge = document.getElementById('health-badge');
    if (badge && data.ok) {
      badge.innerHTML = `<span class="dot green"></span>HEALTHY`;
    } else if (badge) {
      badge.innerHTML = `<span class="dot red"></span>OFFLINE`;
    }
  },

  // ── System Status → Overview Cards ─────────────────────────
  async loadSystemStatus() {
    const data = await this.get('/system/status');
    if (!data || data.error) return;

    this.setVal('stat-version', data.version || '—');
    this.setVal('stat-env', data.environment || '—');
    this.setVal('stat-uptime', this.fmtUptime(data.uptime));
    this.setVal('stat-memory', Math.round((data.memory?.heapUsed || 0) / 1048576) + ' MB');

    const caps = data.capabilities || {};
    this.setVal('stat-nodes', `${caps.nodes?.active || 0} / ${caps.nodes?.total || 0}`);
    this.setVal('stat-tools', caps.tools?.total || 0);
    this.setVal('stat-workflows', caps.workflows?.total || 0);
    this.setVal('stat-services-count', caps.services?.total || 0);

    // Health matrix
    const matrix = await this.get('/services/health-matrix');
    if (matrix && matrix.ok) {
      const scoreEl = document.getElementById('stat-health-score');
      if (scoreEl) {
        scoreEl.textContent = matrix.overallHealth || '—';
        scoreEl.style.color = matrix.overallHealth === 'HEALTHY'
          ? 'var(--success)' : matrix.overallHealth === 'DEGRADED'
          ? 'var(--warning)' : 'var(--danger)';
      }
      this.setVal('stat-score-num', matrix.overallScore || 0);
    }
  },

  // ── Nodes ───────────────────────────────────────────────────
  async loadNodes() {
    const data = await this.get('/nodes');
    if (!data || !data.nodes) return;
    this.nodesData = data;

    const grid = document.getElementById('node-grid');
    if (!grid) return;
    grid.innerHTML = data.nodes.map(n => `
      <div class="node-item" id="node-${n.id}">
        <div class="node-info">
          <div class="node-name">${n.name || n.id}</div>
          <div class="node-role">${n.role || n.tier || '—'}</div>
        </div>
        <button class="node-status ${n.status || 'available'}"
                onclick="H.toggleNode('${n.id}', '${n.status}')"
                title="Click to toggle">
          ${n.status || 'unknown'}
        </button>
      </div>
    `).join('');

    this.setVal('nodes-summary', `${data.active} active / ${data.total} total`);
  },

  async toggleNode(id, currentStatus) {
    const action = currentStatus === 'active' ? 'deactivate' : 'activate';
    await this.post(`/nodes/${id}/${action}`, {});
    this.loadNodes();
  },

  // ── Services ────────────────────────────────────────────────
  async loadServices() {
    const data = await this.get('/services/health-matrix');
    if (!data || !data.ok) return;
    this.servicesData = data;

    // Subsystems
    const svcList = document.getElementById('svc-subsystems');
    if (svcList && data.subsystems) {
      svcList.innerHTML = Object.entries(data.subsystems).map(([name, info]) => `
        <div class="svc-item">
          <span class="svc-name">${this.fmtName(name)}</span>
          <span class="svc-badge ${info.loaded ? 'loaded' : 'unloaded'}">
            ${info.loaded ? '● loaded' : '○ not loaded'}
          </span>
        </div>
      `).join('');
    }

    // Wave services list
    const waveList = document.getElementById('svc-wave');
    if (waveList && data.services?.list) {
      waveList.innerHTML = data.services.list.map(s => `
        <div class="svc-item">
          <span class="svc-name">${this.fmtName(s.id)}</span>
          <span class="svc-badge ${s.status === 'active' || s.status === 'healthy' ? 'loaded' : 'unloaded'}">
            ${s.status}
          </span>
        </div>
      `).join('');
    }

    this.setVal('svc-summary',
      `${data.services?.healthy || 0}/${data.services?.total || 0} healthy · Score: ${data.overallScore || 0}`
    );
  },

  // ── Resources ───────────────────────────────────────────────
  async loadResources() {
    const data = await this.get('/resources/health');
    if (!data) return;

    this.setGauge('cpu', data.cpu?.currentPercent || 0);
    this.setGauge('ram', data.ram?.currentPercent || 0);
    this.setGauge('disk', data.disk?.currentPercent || 0);

    this.setVal('res-cpu-detail', `${data.cpu?.cores || '?'} cores`);
    this.setVal('res-ram-detail',
      `${data.ram?.absoluteValue || 0} / ${data.ram?.capacity || 0} ${data.ram?.unit || 'MB'}`
    );
    this.setVal('res-disk-detail',
      data.disk?.capacity > 0
        ? `${data.disk.absoluteValue || 0} / ${data.disk.capacity} ${data.disk.unit || 'GB'}`
        : 'N/A'
    );
    this.setVal('res-status', data.status || '—');
  },

  setGauge(id, pct) {
    const fill = document.getElementById(`gauge-${id}`);
    const val = document.getElementById(`gauge-${id}-val`);
    if (fill) {
      fill.style.width = Math.min(pct, 100) + '%';
      fill.className = `gauge-fill ${pct > 85 ? 'warn' : 'ok'}`;
    }
    if (val) val.textContent = pct + '%';
  },

  // ── Pipeline ────────────────────────────────────────────────
  async loadPipeline() {
    const [config, state] = await Promise.all([
      this.get('/pipeline/config'),
      this.get('/pipeline/state'),
    ]);

    const el = document.getElementById('pipeline-info');
    if (!el) return;

    if (config?.error) {
      el.innerHTML = `<div class="card"><div class="card-title">Pipeline</div>
        <p style="color:var(--text-muted)">Pipeline engine not loaded: ${config.reason || config.error}</p></div>`;
      return;
    }

    el.innerHTML = `
      <div class="pipeline-state">
        <div class="card">
          <div class="card-title">Configuration</div>
          <pre style="font-family:var(--mono);font-size:0.75rem;color:var(--accent);white-space:pre-wrap;max-height:300px;overflow:auto">${JSON.stringify(config, null, 2)}</pre>
        </div>
        <div class="card">
          <div class="card-title">Last Run</div>
          ${state?.state ? `
            <p><strong>Run ID:</strong> ${state.runId}</p>
            <p><strong>Status:</strong> ${state.status}</p>
          ` : '<p style="color:var(--text-muted)">No pipeline runs yet</p>'}
        </div>
      </div>
    `;
  },

  async runPipeline() {
    const res = await this.post('/pipeline/run', {});
    if (res.ok) this.loadPipeline();
  },

  async toggleContinuous(action) {
    await this.post('/buddy/pipeline/continuous', { action });
    this.loadPipeline();
  },

  // ── Registry ────────────────────────────────────────────────
  async loadRegistry() {
    const data = await this.get('/registry');
    if (!data || data.error) return;

    const tbody = document.getElementById('registry-body');
    if (!tbody) return;
    const components = data.components || [];
    tbody.innerHTML = components.map(c => `
      <tr>
        <td><strong>${c.name || c.id}</strong></td>
        <td><span class="reg-type">${c.type}</span></td>
        <td>${c.version || '—'}</td>
        <td class="reg-status-${c.status}">${c.status}</td>
        <td>${c.criticality || '—'}</td>
      </tr>
    `).join('');

    this.setVal('reg-summary', `${components.length} components`);
  },

  // ── Swarms ────────────────────────────────────────────
  async loadSwarms() {
    const data = await this.get('/swarms/status');
    const swarmList = document.getElementById('swarm-list');
    const auditList = document.getElementById('swarm-audit');
    if (!swarmList) return;

    if (!data || data.error) {
      // Fallback: try consensus endpoint
      const fallback = await this.get('/swarms/consensus');
      if (fallback && fallback.swarms) {
        this.setVal('swarms-summary', `${fallback.swarmCount} swarm domains (orchestrator offline)`);
        swarmList.innerHTML = fallback.swarms.map(s => `
          <div class="svc-item">
            <span class="svc-name">${s.domain}</span>
            <span class="svc-badge loaded">${s.ring} ring</span>
          </div>
        `).join('');
      } else {
        this.setVal('swarms-summary', 'Swarm Orchestrator not loaded');
        swarmList.innerHTML = '<div style="color:var(--text-muted);padding:12px">Start HeadyManager to see swarm status</div>';
      }
      return;
    }

    this.setVal('swarms-summary', `${data.swarmCount} swarms · ${data.totalTasks} tasks · ${data.busMessagesLast60s} bus msgs`);

    swarmList.innerHTML = data.swarms.map(s => {
      const statusClass = s.status === 'active' ? 'loaded' :
                         s.status === 'error' ? 'unloaded' : 'loaded';
      const statusColor = s.status === 'active' ? 'var(--success)' :
                         s.status === 'error' ? 'var(--danger)' : 'var(--text-muted)';
      return `
        <div class="svc-item" style="display:flex;justify-content:space-between;align-items:center">
          <span class="svc-name">${s.name}</span>
          <span style="font-size:0.72rem;color:var(--text-muted);font-family:var(--mono)">
            P${s.priority} · Q:${s.queue} · ✓${s.stats?.completed || 0} · ✗${s.stats?.failed || 0}
          </span>
          <span class="svc-badge ${statusClass}" style="color:${statusColor}">
            ${s.status}
          </span>
        </div>
      `;
    }).join('');

    // Load audit log
    if (auditList) {
      const auditData = await this.get('/swarms/audit?since=' + (Date.now() - 3600000));
      if (auditData && auditData.entries) {
        auditList.innerHTML = auditData.entries.slice(-20).reverse().map(e => `
          <div class="svc-item">
            <span class="svc-name" style="font-size:0.7rem;">${e.action}</span>
            <span style="font-size:0.65rem;color:var(--text-muted);font-family:var(--mono)">
              ${new Date(e.ts).toLocaleTimeString()}
            </span>
          </div>
        `).join('');
      } else {
        auditList.innerHTML = '<div style="color:var(--text-muted);padding:8px;font-size:0.75rem">No audit entries yet</div>';
      }
    }
  },

  async dispatchSwarmTask() {
    const type = prompt('Task type (e.g. deploy, test, analyze, health_check):');
    if (!type) return;
    const targetSwarm = prompt('Target swarm (leave empty for auto-route):') || undefined;
    const res = await this.post('/swarms/dispatch', {
      type,
      targetSwarm,
      payload: { source: 'dashboard', dispatched_by: 'user' },
      priority: 'NORMAL',
    });
    if (res && res.ok) {
      alert(`✓ Task dispatched!\nID: ${res.taskId}\nTarget: ${res.targetSwarm}\nStatus: ${res.status}`);
      this.loadSwarms();
    } else {
      alert('Dispatch failed: ' + (res?.error || 'Unknown error'));
    }
  },

  // ── Colab Runtimes ────────────────────────────────────
  async loadColab() {
    const data = await this.get('/colab/runtimes');
    const grid = document.getElementById('colab-grid');
    if (!grid) return;

    if (!data || !data.runtimes) {
      this.setVal('colab-summary', 'Colab API unavailable');
      grid.innerHTML = '<div class="card" style="padding:20px;color:var(--text-muted)">Start HeadyManager to see Colab runtimes</div>';
      return;
    }

    this.setVal('colab-summary', `${data.live}/${data.total} live · ${data.subscriptions}`);

    grid.innerHTML = data.runtimes.map(rt => {
      const liveTag = rt.live
        ? '<span style="color:var(--success);font-weight:600">● LIVE</span>'
        : '<span style="color:var(--text-muted)">○ offline</span>';
      const metrics = rt.latestMetrics;
      let metricsHtml = '';
      if (metrics) {
        metricsHtml = `
          <div style="margin-top:8px;font-size:0.72rem;color:var(--text-dim);font-family:var(--mono)">
            Loss: ${metrics.loss?.toFixed(4) || '—'} · PPL: ${metrics.perplexity?.toFixed(2) || '—'}
          </div>
        `;
      }
      return `
        <div class="card">
          <div class="card-title">${rt.name || rt.id}</div>
          <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:8px">${rt.role || '—'}</div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:0.72rem;font-family:var(--mono);color:var(--accent)">${rt.gpu?.name || rt.gpu || '—'}</span>
            ${liveTag}
          </div>
          <div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px">${rt.subscription || 'Pro+'} · ${rt.script || ''}</div>
          ${metricsHtml}
        </div>
      `;
    }).join('');
  },

  // ── Chat ────────────────────────────────────────────────────
  async sendChat() {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';

    this.addChatMsg('user', msg);
    this.addChatMsg('assistant', '<span class="spinner"></span>');

    const res = await this.post('/buddy/chat', { message: msg });
    // Remove spinner
    const msgs = document.getElementById('chat-messages');
    if (msgs && msgs.lastChild) msgs.removeChild(msgs.lastChild);

    this.addChatMsg('assistant', res.reply || res.error || 'No response');
  },

  sendChatFromChip(text) {
    const input = document.getElementById('chat-input');
    if (input) { input.value = text; this.sendChat(); }
  },

  addChatMsg(role, content) {
    const msgs = document.getElementById('chat-messages');
    if (!msgs) return;
    const div = document.createElement('div');
    div.className = `chat-msg ${role}`;
    div.innerHTML = `
      <div>${content}</div>
      <div class="msg-meta">${role === 'user' ? 'You' : 'HeadyBuddy'} · ${new Date().toLocaleTimeString()}</div>
    `;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    this.chatHistory.push({ role, content });
  },

  async loadBuddySuggestions() {
    const data = await this.get('/buddy/suggestions');
    const container = document.getElementById('chat-chips');
    if (!container || !data?.suggestions) return;
    container.innerHTML = data.suggestions.map(s =>
      `<button class="chip" onclick="H.sendChatFromChip('${s.prompt.replace(/'/g, "\\'")}')">
        ${s.label}
      </button>`
    ).join('');
  },

  // ── Helpers ─────────────────────────────────────────────────
  setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  },

  fmtUptime(seconds) {
    if (!seconds) return '—';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  },

  fmtName(str) {
    return str.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase()).trim();
  },
};

// Boot
document.addEventListener('DOMContentLoaded', () => H.init());
