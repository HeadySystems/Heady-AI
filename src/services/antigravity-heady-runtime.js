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
// ║  FILE: src/services/antigravity-heady-runtime.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const {
    readRegistry,
    readOptimizationPolicy,
    selectTemplatesForSituation,
    validateRegistry,
} = require('./headybee-template-registry');

const ROOT = path.join(__dirname, '..', '..');
const POLICY_PATH = path.join(ROOT, 'configs', 'services', 'antigravity-heady-runtime-policy.json');

function readPolicy(filePath = POLICY_PATH) {
    const policy = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!policy?.enforce?.gateway || !policy?.enforce?.workspaceMode) {
        throw new Error(`Invalid antigravity runtime policy: ${filePath}`);
    }
    return policy;
}

function isOwnerInitiated(initiatedBy, policy = readPolicy()) {
    if (!initiatedBy) return false;
    const normalized = String(initiatedBy).toLowerCase().trim();
    return (policy.ownerAliases || []).map((alias) => alias.toLowerCase()).includes(normalized);
}

function enforceHeadyForAntigravityOperation(input, options = {}) {
    const policy = options.policy || readPolicy();
    const registry = options.registry || readRegistry();
    const optimizationPolicy = options.optimizationPolicy || readOptimizationPolicy();
    const validation = validateRegistry(registry);

    if (!validation.valid) {
        logger.logError('SYSTEM', 'antigravity-runtime-registry-invalid', validation.errors.join('; '));
        throw new Error('HeadyBee registry invalid; antigravity execution cannot proceed safely.');
    }

    const operation = {
        initiatedBy: input?.initiatedBy || 'unknown',
        source: input?.source || 'unknown',
        task: input?.task || 'unspecified',
        situation: input?.situation || 'digital-presence-launch',
        metadata: input?.metadata || {},
    };

    const ownerInitiated = isOwnerInitiated(operation.initiatedBy, policy);
    const fromAntigravity = String(operation.source).toLowerCase() === 'antigravity';

    const templates = selectTemplatesForSituation(registry, operation.situation, 3, optimizationPolicy);

    const plan = {
        enforced: ownerInitiated && fromAntigravity,
        gateway: policy.enforce.gateway,
        workspaceMode: policy.enforce.workspaceMode,
        autonomousMode: policy.enforce.autonomousMode,
        operation,
        selectedTemplates: templates,
        requiredSwarmTasks: policy.defaultSwarmTasks,
        vectorWorkspace: {
            enabled: true,
            dimensions: 3,
            zoneRouting: true,
            instantExecution: true,
        },
    };

    logger.logSystem(`[AntigravityHeadyRuntime] enforced=${plan.enforced} source=${operation.source} situation=${operation.situation} templates=${templates.length}`);
    return plan;
}

function getHealthStatus() {
    const policy = readPolicy();
    return {
        endpoint: policy.healthEndpoint || '/api/antigravity/health',
        status: 'healthy',
        workspaceMode: policy.enforce.workspaceMode,
        gateway: policy.enforce.gateway,
        autonomousMode: policy.enforce.autonomousMode,
    };
}

module.exports = {
    POLICY_PATH,
    readPolicy,
    isOwnerInitiated,
    enforceHeadyForAntigravityOperation,
    getHealthStatus,
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
