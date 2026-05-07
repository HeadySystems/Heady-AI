/**
 * DisplayBee — Interactive Kiosk UI Orchestration
 * 
 * Manages remote screen states and dynamic content delivery for physical kiosks.
 */

'use strict';

class DisplayBee {
    constructor() {
        this.currentStates = new Map(); // kioskId -> state
    }

    /**
     * Transition a kiosk UI to a new state.
     * @param {string} kioskId 
     * @param {string} state — 'IDLE', 'SELECTION', 'VERIFICATION', 'CHECKOUT'
     */
    async transition(kioskId, state) {
        console.log(`🖥️ [DisplayBee] Transitioning Kiosk ${kioskId} to state: ${state}...`);
        
        this.currentStates.set(kioskId, state);
        
        // Simulation: Pushing UI state update to kiosk edge device
        const content = this._getContentForState(state);
        
        return { kioskId, state, contentPush: 'SUCCESS' };
    }

    _getContentForState(state) {
        const contentMap = {
            'IDLE': { banner: 'Welcome to Heady™ Sovereign Retail', video: 'sacred-geometry-loop.mp4' },
            'SELECTION': { grid: 'product-catalog-v2', filters: ['Hybrid', 'Sativa', 'Indica'] },
            'VERIFICATION': { prompt: 'Please scan your ID', instructions: 'Align face with scanner' },
            'CHECKOUT': { payment: 'USDC/SOL/HDC', summary: 'Order Total' }
        };
        return contentMap[state] || contentMap['IDLE'];
    }
}

module.exports = new DisplayBee();
