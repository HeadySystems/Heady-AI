/**
 * IoTBee — Physical Hardware & Sensor Integration
 * 
 * Orchestrates physical actions via IoT sensors (locks, scales, weight sensors).
 */

'use strict';

class IoTBee {
    constructor() {
        this.sensors = ['LOCK_A', 'SCALE_1', 'THERMAL_0'];
    }

    /**
     * Unlock a physical door lock.
     * @param {string} lockId 
     */
    async unlock(lockId) {
        console.log(`🔓 [IoTBee] Unlocking physical door: ${lockId}...`);
        
        // Simulation: Sending signal to electronic relay
        return { lock: lockId, status: 'UNLOCKED', timestamp: new Date().toISOString() };
    }

    /**
     * Read current weight from a scale.
     * @param {string} scaleId 
     */
    async getWeight(scaleId) {
        console.log(`⚖️ [IoTBee] Reading weight from scale: ${scaleId}...`);
        
        // Simulation: Polling USB/Bluetooth weight scale
        const weight = 3.5; // grams
        return { scale: scaleId, weight, unit: 'g' };
    }

    /**
     * Trigger a physical alert (e.g., LED flash).
     */
    async triggerAlert() {
        console.log('🚨 [IoTBee] Triggering physical kiosk alert LED...');
        return { ok: true };
    }
}

module.exports = new IoTBee();
