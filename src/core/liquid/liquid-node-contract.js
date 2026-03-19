/**
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║  PROPRIETARY AND CONFIDENTIAL — HEADYSYSTEMS INC.                   ║
 * ║  Copyright © 2026 HeadySystems Inc. All Rights Reserved.            ║
 * ║  Protected under the Defend Trade Secrets Act (18 U.S.C. § 1836)   ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 *
 * Liquid Node Contract — Standard Microservice Interface
 * ═══════════════════════════════════════════════════════════════════
 *
 * Every service in the Heady ecosystem implements this contract.
 * NOT a base class (no god class) — it's a mixin factory + validator.
 *
 * Usage:
 *   const { liquidify } = require('../shared/liquid-node-contract');
 *   class MyService extends EventEmitter { ... }
 *   module.exports = liquidify(new MyService(), {
 *     id: 'my-service',
 *     infra: ['cloudflare', 'upstash', 'sentry'],
 *     endpoints: ['/api/my-service/health'],
 *     events: { emits: ['task:done'], reacts: ['task:new'] }
 *   });
 *
 * Lifecycle States (from liquid-state-manager):
 *   LATENT → MATERIALIZING → PROJECTED → STALE → PRUNED
 *
 * @module liquid-node-contract
 */

'use strict';

const PHI = 1.618033988749895;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377];

// ─── Lifecycle States ───────────────────────────────────────────────────────

const LIFECYCLE = Object.freeze({
    LATENT: 'LATENT',
    MATERIALIZING: 'MATERIALIZING',
    PROJECTED: 'PROJECTED',
    STALE: 'STALE',
    PRUNED: 'PRUNED',
});

// ─── Infrastructure Providers ───────────────────────────────────────────────

const INFRA_PROVIDERS = Object.freeze({
    CLOUDFLARE: 'cloudflare',
    GCLOUD: 'gcloud',
    COLAB: 'colab',
    UPSTASH: 'upstash',
    NEON: 'neon',
    SENTRY: 'sentry',
    GITHUB: 'github',
    GITHUB_ACTIONS: 'github-actions',
    GITHUB_APPS: 'github-apps',
    GISTS: 'gists',
    DRUPAL: 'drupal',
});

// ─── Node Registry (global in-process) ──────────────────────────────────────

const _registry = new Map();

/**
 * Get all registered liquid nodes.
 * @returns {Map<string, Object>} node ID → node instance
 */
function getRegistry() { return _registry; }

/**
 * Get a specific liquid node by ID.
 * @param {string} id
 * @returns {Object|null}
 */
function getNode(id) { return _registry.get(id) || null; }

// ─── Liquid Node Mixin ──────────────────────────────────────────────────────

/**
 * Apply liquid node contract to any service instance.
 * Adds lifecycle, health, metrics, and registration — without inheritance.
 *
 * @param {Object} service - Service instance (class or plain object)
 * @param {Object} opts
 * @param {string} opts.id - Unique node identifier
 * @param {string} [opts.version='4.1.0']
 * @param {string[]} [opts.infra] - Infrastructure providers used
 * @param {string[]} [opts.endpoints] - Gateway API routes
 * @param {Object} [opts.events] - { emits: string[], reacts: string[] }
 * @returns {Object} The service, now registered as a liquid node
 */
function liquidify(service, opts = {}) {
    if (!opts.id) throw new Error('liquidify requires opts.id');

    // ── Node metadata ────────────────────────────────────────────────────
    service.__liquid = {
        id: opts.id,
        version: opts.version || '4.1.0',
        lifecycle: LIFECYCLE.LATENT,
        infra: opts.infra || [],
        endpoints: opts.endpoints || [],
        events: opts.events || { emits: [], reacts: [] },
        startedAt: null,
        metrics: {
            requests: 0,
            errors: 0,
            lastActiveAt: null,
            uptimeMs: 0,
        },
    };

    // ── Lifecycle methods (non-destructive — wraps existing) ─────────────

    const _origStart = service.start?.bind(service);
    const _origStop = service.stop?.bind(service);

    service.start = async function (config) {
        this.__liquid.lifecycle = LIFECYCLE.MATERIALIZING;
        this.__liquid.startedAt = Date.now();
        try {
            if (_origStart) await _origStart(config);
            this.__liquid.lifecycle = LIFECYCLE.PROJECTED;
            _registry.set(opts.id, this);
            if (this.emit) this.emit('liquid:projected', { id: opts.id });
        } catch (e) {
            this.__liquid.lifecycle = LIFECYCLE.STALE;
            throw e;
        }
    };

    service.stop = async function () {
        try {
            if (_origStop) await _origStop();
        } finally {
            this.__liquid.lifecycle = LIFECYCLE.PRUNED;
            this.__liquid.metrics.uptimeMs = Date.now() - (this.__liquid.startedAt || Date.now());
            _registry.delete(opts.id);
            if (this.emit) this.emit('liquid:pruned', { id: opts.id });
        }
    };

    // ── Health check (standard interface) ────────────────────────────────

    if (!service.health) {
        service.health = function () {
            return {
                id: this.__liquid.id,
                status: this.__liquid.lifecycle === LIFECYCLE.PROJECTED ? 'healthy' : this.__liquid.lifecycle,
                version: this.__liquid.version,
                lifecycle: this.__liquid.lifecycle,
                uptime: this.__liquid.startedAt ? Date.now() - this.__liquid.startedAt : 0,
                metrics: { ...this.__liquid.metrics },
                infra: this.__liquid.infra,
                endpoints: this.__liquid.endpoints,
            };
        };
    }

    // ── Manifest export (for liquid-os-manifest.json updates) ────────────

    service.toManifest = function () {
        return {
            id: this.__liquid.id,
            version: this.__liquid.version,
            lifecycle: this.__liquid.lifecycle,
            infra: this.__liquid.infra,
            endpoints: this.__liquid.endpoints,
            events: this.__liquid.events,
            metrics: this.__liquid.metrics,
        };
    };

    // ── Auto-register ────────────────────────────────────────────────────
    _registry.set(opts.id, service);

    return service;
}

// ─── Validate Contract ──────────────────────────────────────────────────────

/**
 * Validate that a service implements the liquid node contract.
 * @param {Object} service
 * @returns {{ valid: boolean, missing: string[] }}
 */
function validateContract(service) {
    const required = ['start', 'stop', 'health', '__liquid'];
    const missing = required.filter(m => !service[m]);
    return { valid: missing.length === 0, missing };
}

// ─── Health Aggregator ──────────────────────────────────────────────────────

/**
 * Get health from all registered liquid nodes.
 * @returns {Object} { nodes: Object[], healthy: number, total: number }
 */
function aggregateHealth() {
    const nodes = [];
    for (const [id, node] of _registry) {
        try {
            nodes.push(node.health());
        } catch (e) {
            nodes.push({ id, status: 'error', error: e.message });
        }
    }
    return {
        nodes,
        healthy: nodes.filter(n => n.status === 'healthy').length,
        total: nodes.length,
        timestamp: new Date().toISOString(),
    };
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
    liquidify,
    validateContract,
    getRegistry,
    getNode,
    aggregateHealth,
    LIFECYCLE,
    INFRA_PROVIDERS,
};
