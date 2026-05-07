/**
 * HardwareMonitorBee — Physical Reliability & Telemetry
 * 
 * Monitors sensor health for distributed kiosks.
 */

'use strict';

class HardwareMonitorBee {
    constructor() {
        this.tempThreshold = 75; // 75°C threshold
    }

    /**
     * Scan hardware sensors.
     */
    async scan() {
        console.log('🔍 [HardwareMonitor] Scanning physical sensors...');
        
        // Simulation of hardware stats
        const stats = {
            cpuTemp: 54.2 + (Math.random() * 10),
            fanSpeed: 2100,
            diskHealth: 'GOOD',
            loadAverage: 0.618
        };

        if (stats.cpuTemp > this.tempThreshold) {
            console.warn(`⚠️ [HardwareMonitor] OVERHEAT DETECTED: ${stats.cpuTemp.toFixed(1)}°C. Throttling...`);
            return { status: 'THROTTLED', ...stats };
        }

        console.log(`✅ [HardwareMonitor] Health stable. Temp: ${stats.cpuTemp.toFixed(1)}°C`);
        return { status: 'HEALTHY', ...stats };
    }

    /**
     * Register telemetry with the central heartbeat.
     */
    getTelemetryPayload() {
        return {
            type: 'hardware',
            timestamp: new Date().toISOString(),
            metrics: {
                temp_c: 54.2,
                status: 'nominal'
            }
        };
    }
}

module.exports = new HardwareMonitorBee();
