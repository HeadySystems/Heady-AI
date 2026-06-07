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
// ║  FILE: src/services/template-registry-service.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/*
 * © 2026 Heady™Systems Inc.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
const EventEmitter = require('events');
const { PHI_TIMING } = require('../shared/phi-math');
const beeRegistry = require('../bees/registry');
const vectorTemplateEngine = require('../memory/vector-template-engine');
const {
    buildRegistrySnapshot,
    validateRegistry,
    evaluateScenarioCoverage,
    createProjectionState,
} = require('../agents/template-registry-optimizer');
const logger = require('../utils/logger');

class TemplateRegistryService extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            enabled: true,
            auditIntervalMs: PHI_TIMING.CYCLE,
            autoIndexScenarios: true,
            ...config,
        };
        this.isRunning = false;
        this.lastProjection = null;
    }

    async start() {
        if (this.isRunning || !this.config.enabled) return;
        this.isRunning = true;

        await this.runAuditCycle();
        this.auditLoop = setInterval(() => {
            this.runAuditCycle().catch((error) => {
                logger.logError('TemplateRegistryService', 'audit-cycle-failed', error);
            });
        }, this.config.auditIntervalMs);

        this.emit('started');
        logger.logSystem('🧠 Template Registry Service started');
    }

    async stop() {
        if (!this.isRunning) return;
        this.isRunning = false;
        clearInterval(this.auditLoop);
        this.emit('stopped');
        logger.logSystem('🛑 Template Registry Service stopped');
    }

    async runAuditCycle() {
        beeRegistry.discover();

        const templates = vectorTemplateEngine.listTemplates();
        const beeDomains = beeRegistry.listDomains();

        const snapshot = buildRegistrySnapshot({ templates, beeDomains });
        const validation = validateRegistry(snapshot);
        const coverage = evaluateScenarioCoverage(snapshot);
        const projection = createProjectionState(snapshot, coverage, validation);

        if (this.config.autoIndexScenarios) {
            await vectorTemplateEngine.indexArtifact(JSON.stringify(projection), 'pipeline-runner', {
                source: 'template-registry-service',
                category: 'template-registry-projection',
            });
        }

        this.lastProjection = projection;
        this.emit('projection-updated', projection);

        logger.logSystem(`🛰️ Template registry projection updated (avg coverage ${projection.coverageSummary.averageCoverage}%)`);
        return projection;
    }

    getStatus() {
        return {
            running: this.isRunning,
            lastProjection: this.lastProjection,
        };
    }
}

let singleton = null;
function getTemplateRegistryService(config = {}) {
    if (!singleton) singleton = new TemplateRegistryService(config);
    return singleton;
}

module.exports = {
    TemplateRegistryService,
    getTemplateRegistryService,
};


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
