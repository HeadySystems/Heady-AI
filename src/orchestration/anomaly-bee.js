/**
 * AnomalyBee — Real-time Observability & Anomaly Detection
 * 
 * Monitors the ecosystem for unexpected behavior and latency spikes.
 */

'use strict';

class AnomalyBee {
    constructor() {
        this.errorThreshold = 0.05; // 5% error rate
        this.latencyThreshold = 500; // 500ms
    }

    /**
     * Analyze a stream of metrics for anomalies.
     * @param {Array} metrics 
     */
    analyze(metrics) {
        console.log('📡 [AnomalyBee] Analyzing real-time telemetry...');
        
        const errorRate = metrics.filter(m => m.status >= 500).length / metrics.length;
        const avgLatency = metrics.reduce((sum, m) => sum + m.latency, 0) / metrics.length;

        const anomalyScore = (errorRate / this.errorThreshold) * 0.618 + (avgLatency / this.latencyThreshold) * 0.382;
        
        console.log(`🛡️ [AnomalyBee] Current Anomaly Score: ${anomalyScore.toFixed(2)}`);

        if (anomalyScore > 1.0) {
            console.warn('🚨 [AnomalyBee] High Anomaly Score detected. Alerting swarms...');
            return { alert: true, score: anomalyScore, type: 'CRITICAL' };
        }

        return { alert: false, score: anomalyScore };
    }
}

module.exports = new AnomalyBee();
