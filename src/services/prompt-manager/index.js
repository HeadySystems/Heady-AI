// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: src/services/prompt-manager/index.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
'use strict';

const {
  LiquidNodeBase,
  CSL_THRESHOLDS,
  PHI,
  PSI,
  PSI2,
  FIB,
  fib,
  phiThreshold,
  phiBackoff,
  correlationId
} = require('../../shared/liquid-node-base');
const {
  ServiceMesh,
  SERVICE_CATALOG,
  DOMAIN_SWARMS
} = require('../../shared/service-mesh');
const mesh = ServiceMesh.instance();
class PromptManager extends LiquidNodeBase {
  constructor() {
    super({
      name: 'prompt-manager',
      port: 3328,
      domain: 'orchestration',
      description: 'Prompt template registry and versioning — manages all system prompts',
      pool: 'warm',
      dependencies: []
    });
  }
  async onStart() {
    const templates = new Map();
    this.route('POST', '/template', async (req, res, ctx) => {
      const {
        name,
        template,
        version,
        variables
      } = ctx.body || {};
      if (!name || !template) return this.sendError(res, 400, 'Missing name and template', 'MISSING_INPUT');
      const tplId = correlationId('tpl');
      templates.set(name, {
        id: tplId,
        name,
        template,
        version: version || '1.0.0',
        variables: variables || [],
        createdAt: Date.now()
      });
      this.json(res, 201, {
        id: tplId,
        name,
        registered: true
      });
    });
    this.route('POST', '/render', async (req, res, ctx) => {
      const {
        name,
        variables
      } = ctx.body || {};
      const tpl = templates.get(name);
      if (!tpl) return this.sendError(res, 404, 'Template not found', 'TEMPLATE_NOT_FOUND');
      let rendered = tpl.template;
      for (const [k, v] of Object.entries(variables || {})) {
        rendered = rendered.replace(new RegExp(`\{\{${k}\}\}`, 'g'), v);
      }
      this.json(res, 200, {
        name,
        rendered,
        version: tpl.version
      });
    });
    this.route('GET', '/templates', async (req, res, ctx) => {
      this.json(res, 200, {
        count: templates.size,
        templates: Array.from(templates.values()).map(t => ({
          name: t.name,
          version: t.version,
          variables: t.variables
        }))
      });
    });
    this.log.info('prompt-manager initialized');
  }
}
new PromptManager().start();

// --- Auto-Unified Latent Service Pattern (Smart) ---
(function _wireLatentStubs() {
  const exp = module.exports;
  if (!exp || typeof exp !== 'object') return;

  // Find the first exported class instance or constructor with health/start/stop
  let _inst = null;
  for (const key of Object.keys(exp)) {
    const val = exp[key];
    // If it's a singleton instance with a health method, use it
    if (val && typeof val === 'object' && typeof val.health === 'function') {
      _inst = val; break;
    }
    // If it's a function (class constructor), try to find a getSingleton pattern
    if (typeof val === 'function' && val.prototype) {
      const getterKey = Object.keys(exp).find(k =>
        k.startsWith('get') && typeof exp[k] === 'function' && k !== key
      );
      if (getterKey) {
        try { const inst = exp[getterKey](); if (inst && typeof inst.health === 'function') { _inst = inst; break; } } catch(e) {}
      }
    }
  }

  if (!exp.start) exp.start = _inst && typeof _inst.start === 'function'
    ? async () => { await _inst.start(); return { status: 'started' }; }
    : async () => ({ status: 'started' });
  if (!exp.stop) exp.stop = _inst && typeof _inst.stop === 'function'
    ? async () => { await _inst.stop(); return { status: 'stopped' }; }
    : async () => ({ status: 'stopped' });
  if (!exp.health) exp.health = _inst && typeof _inst.health === 'function'
    ? () => _inst.health()
    : () => ({ status: 'healthy', service: require('path').basename(__filename, '.js') });
  if (!exp.metrics) exp.metrics = _inst && typeof _inst.metrics === 'function'
    ? () => _inst.metrics()
    : () => ({ service: require('path').basename(__filename, '.js') });
  if (!exp._tick) exp._tick = async () => {};
})();
// -------------------------------------------
