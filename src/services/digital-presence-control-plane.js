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
// ║  FILE: src/services/digital-presence-control-plane.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/*
 * © 2026 Heady™Systems Inc.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
"use strict";

const logger = require("../utils/logger");
const providerUsageTracker = require("../telemetry/provider-usage-tracker");
let selfAwareness = null;
try { selfAwareness = require("../self-awareness"); } catch (e) {
  logger.error('Unexpected error', { error: e.message, stack: e.stack });
}

class DigitalPresenceControlPlane {
    constructor({ templateRegistry, maintenanceOps, vectorMemory, tracker = providerUsageTracker } = {}) {
        this.templateRegistry = templateRegistry;
        this.maintenanceOps = maintenanceOps;
        this.vectorMemory = vectorMemory;
        this.tracker = tracker;
        this.state = {
            lastRunAt: null,
            lastScore: null,
            runs: 0,
        };
    }

    async evaluate() {
        const templateCoverage = this.templateRegistry.validateCoverage();
        const optimizePlan = this.templateRegistry.getOptimizationPlan();
        const projection = this.templateRegistry.getProjectionStatus();
        const maintenance = this.maintenanceOps.reconcileProjectionState();

        let awareness = { confidence: 1, recommendations: [] };
        if (selfAwareness && typeof selfAwareness.assessSystemState === "function") {
            try {
                awareness = await selfAwareness.assessSystemState("digital presence control plane");
            } catch {
                awareness = { confidence: 1, recommendations: [] };
            }
        }

        const score = this._computeScore({ templateCoverage, optimizePlan, projection, maintenance, awareness });
        this.state.lastRunAt = new Date().toISOString();
        this.state.lastScore = score;
        this.state.runs += 1;

        return {
            ok: true,
            score,
            templateCoverage,
            optimizePlan,
            projection,
            maintenance,
            awareness,
            generatedAt: new Date().toISOString(),
        };
    }

    _computeScore({ templateCoverage, optimizePlan, projection, maintenance, awareness }) {
        const coverageScore = Math.round((templateCoverage.coverageRatio || 0) * 40);
        const projectionScore = projection.ok ? 25 : 5;
        const maintenancePenalty = Math.min(20, maintenance.staleReferenceCount || 0);
        const weakPenalty = Math.min(10, (optimizePlan.weakTemplates || []).length * 2);
        const awarenessBoost = Math.round((Number(awareness.confidence) || 1) * 10);

        return Math.max(0, Math.min(100, coverageScore + projectionScore + awarenessBoost - maintenancePenalty - weakPenalty));
    }

    async runOptimizationCycle({ applyProjectionSync = false, embedSnapshot = false } = {}) {
        const started = Date.now();
        const budget = this.tracker.checkProviderBudget("heady_digital_presence");
        if (budget.status === "exceeded") {
            return { ok: false, error: "budget_exceeded", budget };
        }

        const evaluation = await this.evaluate();
        const projectionSync = this.templateRegistry.syncProjection({ apply: applyProjectionSync });

        let embedded = null;
        if (embedSnapshot && this.vectorMemory && typeof this.vectorMemory.ingestMemory === "function") {
            const id = await this.vectorMemory.ingestMemory({
                content: JSON.stringify({ evaluation, projectionSync }),
                metadata: {
                    type: "digital_presence_optimization",
                    score: evaluation.score,
                    applyProjectionSync,
                },
            });
            embedded = { ok: true, id };
        }

        this.tracker.record({
            provider: "heady_digital_presence",
            account: "heady-core",
            model: "digital-presence-control-v1",
            tokensIn: 0,
            tokensOut: 0,
            costUsd: 0,
            latencyMs: Date.now() - started,
            endpoint: "/api/autonomy/digital-presence/optimize",
            status: "success",
        });

        return {
            ok: true,
            evaluation,
            projectionSync,
            embedded,
            latencyMs: Date.now() - started,
            budget,
            generatedAt: new Date().toISOString(),
        };
    }

    health() {
        return {
            ok: true,
            runs: this.state.runs,
            lastRunAt: this.state.lastRunAt,
            lastScore: this.state.lastScore,
            timestamp: new Date().toISOString(),
        };
    }
}

function registerDigitalPresenceRoutes(app, controlPlane) {
    if (!app || typeof app.get !== "function" || typeof app.post !== "function") {
        throw new Error("Express app required to register digital presence routes.");
    }

    const controller = controlPlane;
    if (!controller) throw new Error("Digital presence control plane instance required.");

    app.get("/api/autonomy/digital-presence/health", (req, res) => {
        res.json(controller.health());
    });

    app.get("/api/autonomy/digital-presence/evaluate", async (req, res) => {
        const result = await controller.evaluate();
        res.json(result);
    });

    app.post("/api/autonomy/digital-presence/optimize", async (req, res) => {
        const result = await controller.runOptimizationCycle({
            applyProjectionSync: req.body?.applyProjectionSync === true,
            embedSnapshot: req.body?.embedSnapshot === true,
        });
        res.status(result.ok ? 200 : 503).json(result);
    });

    logger.logSystem("Digital presence control plane routes registered");
}

module.exports = {
    DigitalPresenceControlPlane,
    registerDigitalPresenceRoutes,
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
