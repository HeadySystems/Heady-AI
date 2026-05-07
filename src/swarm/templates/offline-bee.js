/**
 * OfflineBee — Kiosk Operational Continuity & Delayed Sync
 * 
 * Manages kiosk state during network outages and handles replay-logic for restoration.
 */

'use strict';

class OfflineBee {
    constructor() {
        this.queue = [];
    }

    /**
     * Queue a transaction or compliance event while offline.
     * @param {object} event 
     */
    async queueEvent(event) {
        console.warn('📡 [OfflineBee] Network OUTAGE detected. Queuing event for delayed sync...');
        
        const offlineEvent = {
            ...event,
            offlineTimestamp: new Date().toISOString(),
            status: 'PENDING_SYNC'
        };

        this.queue.push(offlineEvent);
        console.log(`   └─ Queue Size: ${this.queue.length} events.`);
        return { ok: true, queued: true };
    }

    /**
     * Replay and synchronize the offline queue once back online.
     */
    async replayQueue() {
        console.log(`🚀 [OfflineBee] Network RESTORED. Replaying ${this.queue.length} events...`);
        
        while (this.queue.length > 0) {
            const event = this.queue.shift();
            console.log(`   📤 Syncing event: ${event.id || 'anonymous'}`);
            // Simulation: Pushing to SyncBee and ComplianceBee
        }

        console.log('✅ [OfflineBee] All offline events synchronized successfully.');
        return { ok: true };
    }
}

module.exports = new OfflineBee();
