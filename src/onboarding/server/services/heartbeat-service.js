/**
 * Node Heartbeat Service
 * 
 * Monitors health of distributed K8s nodes and kiosks.
 */

'use strict';

class HeartbeatService {
    constructor() {
        this.nodes = new Map();
        this.timeoutLimit = 30000; // 30 seconds
    }

    /**
     * Record a heartbeat from a node.
     */
    async pulse(nodeId, metadata = {}) {
        console.log(`💓 [Heartbeat] Received pulse from ${nodeId}`);
        
        this.nodes.set(nodeId, {
            status: 'online',
            lastPulse: Date.now(),
            region: metadata.region || 'unknown',
            load: metadata.load || 0,
            version: metadata.version || '3.0.0'
        });

        return { ok: true, timestamp: new Date().toISOString() };
    }

    /**
     * Get health of all nodes.
     */
    getHealthSnapshot() {
        const now = Date.now();
        const snapshot = [];

        this.nodes.forEach((data, id) => {
            const isStale = (now - data.lastPulse) > this.timeoutLimit;
            snapshot.push({
                id,
                status: isStale ? 'offline' : 'online',
                latency: now - data.lastPulse,
                ...data
            });
        });

        return snapshot;
    }

    /**
     * Cleanup stale nodes.
     */
    cleanup() {
        const now = Date.now();
        this.nodes.forEach((data, id) => {
            if ((now - data.lastPulse) > this.timeoutLimit * 2) {
                console.warn(`💀 [Heartbeat] Removing dead node: ${id}`);
                this.nodes.delete(id);
            }
        });
    }
}

// Global instance for the server
export const heartbeatService = new HeartbeatService();

// Auto-cleanup every minute
setInterval(() => heartbeatService.cleanup(), 60000);
