/**
 * Drift Detector — Self-Healing Module
 * Detects configuration and behavioral drift across services.
 * 
 * @module core/self-healing/drift-detector
 * @version 1.0.0
 * @author HeadySystems™
 */

'use strict';

const { EventEmitter } = require('events');
const PHI = 1.618033988749895;

class DriftDetector extends EventEmitter {
    constructor(opts = {}) {
        super();
        this.checkInterval = opts.checkInterval || Math.round(PHI * PHI * PHI * PHI * 1000); // ~6854ms
        this.thresholds = opts.thresholds || {
            config: 0.1,
            behavior: 0.2,
            performance: 0.3,
        };
        this.baselines = new Map();
        this.driftHistory = [];
    }

    setBaseline(serviceId, metrics) {
        this.baselines.set(serviceId, {
            ...metrics,
            timestamp: Date.now(),
        });
    }

    detectDrift(serviceId, currentMetrics) {
        const baseline = this.baselines.get(serviceId);
        if (!baseline) {
            return { drifted: false, reason: 'no_baseline' };
        }

        const drifts = [];
        for (const [key, threshold] of Object.entries(this.thresholds)) {
            if (currentMetrics[key] !== undefined && baseline[key] !== undefined) {
                const delta = Math.abs(currentMetrics[key] - baseline[key]);
                if (delta > threshold) {
                    drifts.push({ metric: key, delta, threshold });
                }
            }
        }

        if (drifts.length > 0) {
            const result = { drifted: true, serviceId, drifts, timestamp: Date.now() };
            this.driftHistory.push(result);
            this.emit('drift:detected', result);
            return result;
        }

        return { drifted: false, serviceId };
    }

    getDriftHistory(serviceId) {
        if (serviceId) {
            return this.driftHistory.filter(d => d.serviceId === serviceId);
        }
        return this.driftHistory;
    }

    health() {
        return {
            service: 'drift-detector',
            version: '1.0.0',
            trackedServices: this.baselines.size,
            totalDriftEvents: this.driftHistory.length,
        };
    }
}

module.exports = { DriftDetector };
