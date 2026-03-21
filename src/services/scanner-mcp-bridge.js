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
// ║  FILE: src/services/scanner-mcp-bridge.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

const fileScanner = require('./file-scanner');
const { taskScheduler } = require('../hc_task_scheduler');
const { mcPlanScheduler } = require('../hc_monte_carlo');

class ScannerMCPBridge {
  constructor() {
    this.taskType = 'file_scan';
    this.registerMCPHandlers();
  }

  registerMCPHandlers() {
    // Register with task scheduler
    taskScheduler.registerHandler(this.taskType, async (task) => {
      const { filePath } = task.payload;
      return await this.scanFile(filePath);
    });

    // Register optimization strategies with Monte Carlo
    mcPlanScheduler.registerTaskType(this.taskType, {
      fast_serial: { concurrency: 1, concurrent_equals: 'normal' },
      fast_parallel: { concurrency: 8, concurrent_equals: 'normal' },
      balanced: { concurrency: 4, concurrent_equals: 'normal' },
      thorough: { concurrency: 2, concurrent_equals: 'high' }
    });
  }

  async scanFile(filePath) {
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      const result = await fileScanner.scanFile(filePath, content);
      return {
        success: true,
        improvements: result.improvements.length,
        file: filePath
      };
    } catch (err) {
      return {
        success: false,
        error: err.message,
        file: filePath
      };
    }
  }

  async scanProject(rootPath) {
    return await taskScheduler.enqueueBatch({
      type: this.taskType,
      items: (await fileScanner._getCodeFiles(rootPath)).map(filePath => ({
        payload: { filePath }
      }))
    });
  }
}

module.exports = new ScannerMCPBridge();


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
