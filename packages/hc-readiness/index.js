const { createLogger } = require('../../src/utils/logger');
const logger = createLogger('auto-fixed');
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
// ║  FILE: packages/hc-readiness/index.js                            ║
// ║  LAYER: packages                                                 ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

// ═══════════════════════════════════════════════════════════════════
// HC Readiness — Operational Readiness Evaluator
// Computes ORS (Operational Readiness Score) 0–100 by running
// readiness probes defined in configs/app-readiness.yaml.
// ═══════════════════════════════════════════════════════════════════

const ORS_THRESHOLDS = {
  FULL: 85,
  // Full parallelism, aggressive building
  NORMAL: 70,
  // Normal operation
  MAINTENANCE: 50,
  // Reduced load, no new large builds
  RECOVERY: 0 // Repair only
};
class HCReadiness {
  constructor() {
    this.history = [];
    this.probes = [];
  }

  /**
   * Load probe definitions from app-readiness.yaml.
   */
  loadProbes(configPath) {
    const yamlPath = configPath || path.join(__dirname, '../../configs/app-readiness.yaml');
    try {
      if (fs.existsSync(yamlPath)) {
        const yaml = require('js-yaml');
        const config = yaml.load(fs.readFileSync(yamlPath, 'utf8'));
        this.probes = config && config.probes || [];
        logger.info(`[hc-readiness] Loaded ${this.probes.length} probes`);
      }
    } catch (err) {
      logger.error('[hc-readiness] Failed to load probes:', err.message);
    }
    return this;
  }

  /**
   * Evaluate operational readiness by running all probes.
   * Returns ORS score 0–100 and per-probe results.
   */
  async assess() {
    if (this.probes.length === 0) this.loadProbes();
    const results = [];
    let totalWeight = 0;
    let weightedScore = 0;
    for (const probe of this.probes) {
      const weight = probe.criticality === 'critical' ? 3 : probe.criticality === 'high' ? 2 : 1;
      totalWeight += weight;
      const result = await this._runProbe(probe);
      results.push(result);
      if (result.passed) {
        weightedScore += weight;
      }
    }
    const ors = totalWeight > 0 ? Math.round(weightedScore / totalWeight * 100) : 0;
    const mode = ors >= ORS_THRESHOLDS.FULL ? 'full' : ors >= ORS_THRESHOLDS.NORMAL ? 'normal' : ors >= ORS_THRESHOLDS.MAINTENANCE ? 'maintenance' : 'recovery';
    const evaluation = {
      ors,
      mode,
      evaluatedAt: new Date().toISOString(),
      probeCount: this.probes.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
      results
    };
    this.history.push(evaluation);
    if (this.history.length > 50) this.history.shift();
    logger.info(`[hc-readiness] ORS=${ors} mode=${mode} (${evaluation.passed}/${this.probes.length} probes passed)`);
    return evaluation;
  }

  /**
   * Prepare system for a given target mode — returns actions needed.
   */
  async prepare(targetMode = 'normal') {
    const evaluation = await this.assess();
    const actions = [];
    if (evaluation.mode === 'recovery' && targetMode !== 'recovery') {
      actions.push({
        action: 'repair',
        message: 'System in recovery mode — fix failing probes before proceeding'
      });
      for (const r of evaluation.results.filter(r => !r.passed)) {
        actions.push({
          action: 'fix-probe',
          probe: r.name,
          error: r.error
        });
      }
    }
    if (evaluation.mode === 'maintenance' && (targetMode === 'full' || targetMode === 'normal')) {
      actions.push({
        action: 'stabilize',
        message: 'System in maintenance mode — stabilize before scaling'
      });
    }
    return {
      currentMode: evaluation.mode,
      targetMode,
      ors: evaluation.ors,
      ready: evaluation.mode === targetMode || ORS_THRESHOLDS[targetMode.toUpperCase()] <= evaluation.ors,
      actions
    };
  }

  /**
   * Get evaluation history.
   */
  getHistory() {
    return [...this.history];
  }

  /**
   * Run a single probe.
   */
  async _runProbe(probe) {
    const start = Date.now();
    const result = {
      name: probe.name,
      type: probe.type,
      passed: false,
      latencyMs: 0,
      error: null
    };
    if (probe.type === 'http') {
      try {
        const res = await this._httpCheck(probe.url, probe.method || 'GET', probe.maxLatencyMs || 5000);
        result.latencyMs = Date.now() - start;
        result.statusCode = res.statusCode;
        const statusOk = probe.expectedStatus ? res.statusCode === probe.expectedStatus : res.statusCode < 400;
        const latencyOk = result.latencyMs <= (probe.maxLatencyMs || 5000);
        result.passed = statusOk && latencyOk;
        if (!result.passed) {
          result.error = `status=${res.statusCode} latency=${result.latencyMs}ms`;
        }
      } catch (err) {
        result.latencyMs = Date.now() - start;
        result.error = err.message;
      }
    } else if (probe.type === 'tcp') {
      result.passed = true; // TCP probes not yet implemented
      result.error = 'tcp probes not yet supported';
    }
    return result;
  }

  /**
   * Simple HTTP check — returns { statusCode }.
   */
  _httpCheck(url, method, timeoutMs) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      const req = client.request(url, {
        method,
        timeout: timeoutMs
      }, res => {
        res.resume(); // drain
        resolve({
          statusCode: res.statusCode
        });
      });
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('timeout'));
      });
      req.end();
    });
  }
}
module.exports = new HCReadiness();
module.exports.ORS_THRESHOLDS = ORS_THRESHOLDS;