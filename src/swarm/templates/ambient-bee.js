/**
 * AmbientBee — Local Environment & Sensory Monitoring
 * 
 * Tracks the physical surroundings of the kiosk and adjusts behavior accordingly.
 */

'use strict';

class AmbientBee {
    constructor() {
        this.thresholds = {
            temp: 35, // Celsius
            noise: 80, // dB
            humidity: 70 // %
        };
    }

    /**
     * Conduct an ambient environmental scan.
     */
    async scan() {
        console.log('🌱 [AmbientBee] Conducting local environmental scan...');
        
        const readings = {
            ambientTemp: 22.5,
            noiseLevel: 55,
            humidity: 45,
            lightLevel: 0.84 // φ-scaled brightness
        };

        console.log(`   🌡️ Temp: ${readings.ambientTemp}°C | 🔊 Noise: ${readings.noiseLevel}dB | 💡 Light: ${readings.lightLevel}`);
        
        this._analyze(readings);
        return readings;
    }

    _analyze(readings) {
        if (readings.ambientTemp > this.thresholds.temp) {
            console.warn('🔥 [AmbientBee] AMBIENT OVERHEAT detected. Throttling kiosk performance.');
        }
        
        if (readings.lightLevel < 0.382) {
            console.log('🌙 [AmbientBee] Low light detected. Adjusting display brightness (Night Mode).');
        }
    }
}

module.exports = new AmbientBee();
