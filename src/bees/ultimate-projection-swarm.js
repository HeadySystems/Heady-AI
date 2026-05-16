/*
 * © 2026 Heady™Systems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * Ultimate Option Projection Swarm — Comprehensive Task Fore-Sight
 * ════════════════════════════════════════════════════════════════
 *
 * This swarm orchestrates multiple specialized projection bees to
 * provide a 360-degree view of available options for any task intent.
 */

"use strict";

const beeFactory = require('./bee-factory');
const logger = require('../utils/logger').child({ component: 'projection-swarm' });

/**
 * Initializes the Ultimate Projection Swarm.
 * This swarm is registered in the registry upon file load.
 */
function initUltimateProjectionSwarm() {
    const swarmName = 'ultimate-option-projection';
    
    const swarm = beeFactory.createSwarm(swarmName, [
        { 
            domain: 'pre-task-projection', 
            config: { description: 'Identify ranked execution candidates (Bees/Swarms)' } 
        },
        { 
            domain: 'vector-memory-projection', 
            config: { description: 'Project past similar task outcomes for context' } 
        },
        { 
            domain: 'task-queue-projection', 
            config: { description: 'Check for overlapping tasks already in flight' } 
        }
    ], {
        mode: 'parallel', // Run all projections simultaneously for "instant" results
        timeoutMs: 2500   // Keep it snappy
    });

    logger.logSystem(`🚀 [Swarm] ${swarmName} ACTIVATED — Ready for instant pre-task option projection.`);
    return swarm;
}

// Auto-init
module.exports = initUltimateProjectionSwarm();
