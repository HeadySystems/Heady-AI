const { createLogger } = require('../../../src/utils/logger');
const logger = createLogger('auto-fixed');
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Generative UI Renderer v1.0                            ║
// ║  A2UI protocol: agents generate rich interactive UI via JSON    ║
// ║  Renders sacred geometry-themed components from declarative spec║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝

/**
 * HeadyGenUI — Generative UI Renderer
 *
 * Agents send declarative JSON component descriptions via SSE/WebSocket.
 * This renderer converts them into live DOM elements using Heady's
 * sacred geometry design system. No framework — vanilla JS only (Law 3).
 *
 * Component Types:
 * - text: Formatted text with markdown
 * - card: Glass-morphism card with title, content, actions
 * - table: Data table with sorting
 * - chart: Simple bar/line chart (canvas)
 * - progress: Pipeline stage progress
 * - codeblock: Syntax-highlighted code
 * - form: Input form with validation
 * - actions: Button group
 * - status: Service health status
 * - swarm: Swarm activity visualization
 * - pipeline: 22-stage pipeline progress tracker
 */

const PHI = 1.618033988749895;
const PSI = 1 / PHI;
const COMPONENT_REGISTRY = {
  text: renderText,
  card: renderCard,
  table: renderTable,
  chart: renderChart,
  progress: renderProgress,
  codeblock: renderCodeblock,
  form: renderForm,
  actions: renderActions,
  status: renderStatus,
  swarm: renderSwarm,
  pipeline: renderPipeline
};

/**
 * Main render function — takes a component spec and returns DOM element.
 */
export function render(spec) {
  if (!spec || !spec.type) return null;
  const renderer = COMPONENT_REGISTRY[spec.type];
  if (!renderer) {
    logger.warn(`[HeadyGenUI] Unknown component type: ${spec.type}`);
    return renderText({
      content: `[Unknown component: ${spec.type}]`
    });
  }
  const el = renderer(spec);
  if (spec.id) el.id = spec.id;
  if (spec.className) el.classList.add(...spec.className.split(' '));
  return el;
}

/**
 * Render a stream of components from SSE/WebSocket.
 */
export function createStreamRenderer(container) {
  return {
    append(spec) {
      const el = render(spec);
      if (el) {
        el.classList.add('fade-up');
        container.appendChild(el);
      }
    },
    replace(id, spec) {
      const existing = document.getElementById(id);
      const el = render(spec);
      if (existing && el) existing.replaceWith(el);else if (el) container.appendChild(el);
    },
    clear() {
      container.innerHTML = '';
    }
  };
}

// ── Component Renderers ─────────────────────────────────────────────

function renderText(spec) {
  const el = document.createElement('div');
  el.className = 'genui-text';
  el.innerHTML = markdownToHTML(spec.content || '');
  return el;
}
function renderCard(spec) {
  const el = document.createElement('div');
  el.className = 'genui-card glass-card';
  el.innerHTML = `
    ${spec.icon ? `<div class="genui-card-icon">${spec.icon}</div>` : ''}
    ${spec.title ? `<h3 class="genui-card-title">${esc(spec.title)}</h3>` : ''}
    ${spec.subtitle ? `<p class="genui-card-subtitle">${esc(spec.subtitle)}</p>` : ''}
    <div class="genui-card-body">${markdownToHTML(spec.content || '')}</div>
    ${spec.actions ? renderActionsHTML(spec.actions) : ''}
  `;
  return el;
}
function renderTable(spec) {
  const el = document.createElement('div');
  el.className = 'genui-table-wrap';
  const headers = spec.headers || Object.keys(spec.rows?.[0] || {});
  el.innerHTML = `
    <table class="genui-table">
      <thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${(spec.rows || []).map(row => `<tr>${headers.map(h => `<td>${esc(String(row[h] ?? ''))}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  `;
  return el;
}
function renderChart(spec) {
  const el = document.createElement('div');
  el.className = 'genui-chart';
  const canvas = document.createElement('canvas');
  canvas.width = spec.width || 400;
  canvas.height = spec.height || 200;
  el.appendChild(canvas);

  // Simple bar chart (no dependencies)
  requestAnimationFrame(() => {
    const ctx = canvas.getContext('2d');
    const data = spec.data || [];
    const maxVal = Math.max(...data.map(d => d.value), 1);
    const barWidth = canvas.width / data.length - 4;
    ctx.fillStyle = spec.color || '#00d4aa';
    data.forEach((d, i) => {
      const barHeight = d.value / maxVal * (canvas.height - 30);
      const x = i * (barWidth + 4) + 2;
      const y = canvas.height - barHeight - 20;
      ctx.fillRect(x, y, barWidth, barHeight);
      ctx.fillStyle = '#9898aa';
      ctx.font = '10px DM Sans';
      ctx.textAlign = 'center';
      ctx.fillText(d.label || '', x + barWidth / 2, canvas.height - 4);
      ctx.fillStyle = spec.color || '#00d4aa';
    });
  });
  return el;
}
function renderProgress(spec) {
  const el = document.createElement('div');
  el.className = 'genui-progress';
  const pct = Math.min(100, Math.max(0, (spec.value || 0) * 100));
  el.innerHTML = `
    <div class="genui-progress-label">${esc(spec.label || '')} <span>${Math.round(pct)}%</span></div>
    <div class="genui-progress-bar"><div class="genui-progress-fill" style="width:${pct}%"></div></div>
  `;
  return el;
}
function renderCodeblock(spec) {
  const el = document.createElement('pre');
  el.className = 'genui-code';
  const code = document.createElement('code');
  code.textContent = spec.code || spec.content || '';
  if (spec.language) code.className = `language-${spec.language}`;
  el.appendChild(code);
  return el;
}
function renderForm(spec) {
  const el = document.createElement('div');
  el.className = 'genui-form';
  const fields = (spec.fields || []).map(f => `
    <div class="genui-form-field">
      <label>${esc(f.label || f.name)}</label>
      <input type="${f.type || 'text'}" name="${esc(f.name)}" placeholder="${esc(f.placeholder || '')}"
             ${f.required ? 'required' : ''} value="${esc(f.value || '')}">
    </div>
  `).join('');
  el.innerHTML = `
    ${spec.title ? `<h3>${esc(spec.title)}</h3>` : ''}
    ${fields}
    <button class="genui-form-submit" onclick="this.closest('.genui-form').dispatchEvent(new CustomEvent('submit', {detail: Object.fromEntries(new FormData(this.closest('.genui-form').querySelector('form') || this.closest('.genui-form')))}))">
      ${esc(spec.submitLabel || 'Submit')}
    </button>
  `;
  return el;
}
function renderActions(spec) {
  const el = document.createElement('div');
  el.className = 'genui-actions';
  el.innerHTML = renderActionsHTML(spec.actions || spec.buttons || []);
  return el;
}
function renderActionsHTML(actions) {
  return `<div class="genui-actions">${(actions || []).map(a => `
    <button class="genui-btn genui-btn-${a.variant || 'ghost'}"
            onclick="${a.action ? `sendPrompt('${esc(a.action)}')` : ''}"
            ${a.href ? `onclick="window.open('${esc(a.href)}', '_blank')"` : ''}>
      ${esc(a.label)}
    </button>
  `).join('')}</div>`;
}
function renderStatus(spec) {
  const el = document.createElement('div');
  el.className = 'genui-status';
  const services = spec.services || [];
  el.innerHTML = `
    <h3>${esc(spec.title || 'System Status')}</h3>
    <div class="genui-status-grid">
      ${services.map(s => `
        <div class="genui-status-item">
          <span class="genui-status-dot genui-status-${s.status || 'unknown'}"></span>
          <span class="genui-status-name">${esc(s.name)}</span>
          ${s.latency ? `<span class="genui-status-latency">${s.latency}ms</span>` : ''}
        </div>
      `).join('')}
    </div>
  `;
  return el;
}
function renderSwarm(spec) {
  const el = document.createElement('div');
  el.className = 'genui-swarm';
  const bees = spec.bees || [];
  el.innerHTML = `
    <h3>${esc(spec.swarmName || 'Swarm Activity')}</h3>
    <div class="genui-swarm-grid">
      ${bees.map(b => `
        <div class="genui-bee genui-bee-${b.status || 'idle'}" title="${esc(b.type || '')}">
          <span class="genui-bee-icon">🐝</span>
          <span class="genui-bee-label">${esc(b.type || 'bee')}</span>
        </div>
      `).join('')}
    </div>
  `;
  return el;
}
function renderPipeline(spec) {
  const el = document.createElement('div');
  el.className = 'genui-pipeline';
  const stages = spec.stages || [];
  el.innerHTML = `
    <h3>${esc(spec.title || 'HCFullPipeline')}</h3>
    <div class="genui-pipeline-track">
      ${stages.map((s, i) => `
        <div class="genui-pipeline-stage genui-stage-${s.status || 'pending'}" title="Stage ${i}: ${esc(s.name || '')}">
          <span class="genui-stage-num">${i}</span>
          <span class="genui-stage-name">${esc(s.name || `S${i}`)}</span>
        </div>
      `).join('')}
    </div>
  `;
  return el;
}

// ── Utilities ───────────────────────────────────────────────────────

function esc(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
function markdownToHTML(md) {
  return md.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/`(.*?)`/g, '<code>$1</code>').replace(/\n/g, '<br>');
}

// ── CSS (inject once) ───────────────────────────────────────────────
export function injectGenUIStyles() {
  if (document.getElementById('genui-styles')) return;
  const style = document.createElement('style');
  style.id = 'genui-styles';
  style.textContent = `
    .genui-card{background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.06);border-radius:13px;padding:21px;margin:13px 0;backdrop-filter:blur(21px)}
    .genui-card-icon{font-size:2.618rem;margin-bottom:8px}
    .genui-card-title{font-size:1.35rem;font-weight:600;margin-bottom:5px}
    .genui-card-subtitle{color:#9898aa;font-size:0.875rem;margin-bottom:13px}
    .genui-table-wrap{overflow-x:auto;margin:13px 0}
    .genui-table{width:100%;border-collapse:collapse;font-size:0.875rem}
    .genui-table th{text-align:left;padding:8px 13px;border-bottom:1px solid rgba(255,255,255,0.1);color:#9898aa;font-weight:500;font-size:11px;text-transform:uppercase;letter-spacing:0.5px}
    .genui-table td{padding:8px 13px;border-bottom:1px solid rgba(255,255,255,0.04)}
    .genui-progress{margin:13px 0}
    .genui-progress-label{display:flex;justify-content:space-between;font-size:0.875rem;margin-bottom:5px}
    .genui-progress-bar{height:5px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden}
    .genui-progress-fill{height:100%;background:#00d4aa;border-radius:3px;transition:width 0.5s cubic-bezier(0.618,0,0.382,1)}
    .genui-code{background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:13px;overflow-x:auto;font-family:'JetBrains Mono',monospace;font-size:0.8rem;line-height:1.5}
    .genui-actions{display:flex;gap:8px;margin-top:13px;flex-wrap:wrap}
    .genui-btn{padding:8px 21px;border-radius:8px;border:none;cursor:pointer;font-family:inherit;font-size:0.875rem;transition:all 0.3s cubic-bezier(0.618,0,0.382,1)}
    .genui-btn-primary{background:#00d4aa;color:#000;font-weight:500}
    .genui-btn-primary:hover{background:#00eabb;box-shadow:0 0 21px rgba(0,212,170,0.25)}
    .genui-btn-ghost{background:transparent;border:1px solid rgba(255,255,255,0.06);color:#9898aa}
    .genui-btn-ghost:hover{border-color:#9898aa;color:#e8e8f2}
    .genui-status-grid{display:flex;flex-direction:column;gap:5px;margin-top:8px}
    .genui-status-item{display:flex;align-items:center;gap:8px;font-size:0.875rem}
    .genui-status-dot{width:8px;height:8px;border-radius:50%}
    .genui-status-healthy{background:#22c55e}.genui-status-degraded{background:#f59e0b}.genui-status-down{background:#ef4444}.genui-status-unknown{background:#606070}
    .genui-status-latency{color:#606070;font-size:0.75rem;margin-left:auto}
    .genui-pipeline-track{display:flex;gap:3px;flex-wrap:wrap;margin-top:8px}
    .genui-pipeline-stage{padding:3px 8px;border-radius:4px;font-size:10px;display:flex;align-items:center;gap:3px}
    .genui-stage-pending{background:rgba(255,255,255,0.04);color:#606070}
    .genui-stage-active{background:rgba(0,212,170,0.15);color:#00d4aa;animation:pulse 1.5s infinite}
    .genui-stage-completed{background:rgba(0,212,170,0.08);color:#00d4aa}
    .genui-stage-failed{background:rgba(239,68,68,0.15);color:#ef4444}
    .genui-stage-num{font-weight:700;opacity:0.6}
    .genui-swarm-grid{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}
    .genui-bee{padding:3px 8px;border-radius:4px;font-size:11px;display:flex;align-items:center;gap:3px}
    .genui-bee-active{background:rgba(0,212,170,0.1)}.genui-bee-idle{background:rgba(255,255,255,0.03)}
    .genui-text{line-height:1.6;margin:8px 0}
    .genui-form-field{margin-bottom:13px}
    .genui-form-field label{display:block;font-size:0.875rem;color:#9898aa;margin-bottom:5px}
    .genui-form-field input{width:100%;padding:8px 13px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:8px;color:#e8e8f2;font-family:inherit}
    .genui-form-submit{padding:8px 21px;background:#00d4aa;color:#000;border:none;border-radius:8px;cursor:pointer;font-weight:500}
    .fade-up{animation:fadeUp 0.4s cubic-bezier(0.618,0,0.382,1) both}
    @keyframes fadeUp{from{opacity:0;transform:translateY(13px)}to{opacity:1;transform:translateY(0)}}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}}
  `;
  document.head.appendChild(style);
}

// Auto-init
if (typeof window !== 'undefined') {
  window.HeadyGenUI = {
    render,
    createStreamRenderer,
    injectGenUIStyles
  };
  document.addEventListener('DOMContentLoaded', injectGenUIStyles);
}
export default {
  render,
  createStreamRenderer,
  injectGenUIStyles,
  COMPONENT_REGISTRY
};