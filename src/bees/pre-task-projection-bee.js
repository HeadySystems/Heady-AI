/*
 * © 2026 Heady™Systems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * Pre-Task Projection Bee — Intent-Aware Option Discovery
 * ══════════════════════════════════════════════════════
 *
 * This bee is responsible for projecting all available execution paths
 * (Bees, Swarms, or Work Units) before a task is committed.
 * It uses CSL multi_resonance to rank candidates and provides a
 * transparent "Option Set" to the user.
 */

"use strict";

const beeFactory = require('./bee-factory');
const registry = require('./registry');
const logger = require('../utils/logger').child({ component: 'projection-bee' });

class PreTaskProjectionBee {
    constructor() {
        this.domain = 'pre-task-projection';
        this.description = 'Projects available execution options for any task intent.';
        this.priority = 1.0;
    }

    /**
     * Projects execution options for a given intent.
     * 
     * @param {string} intent - The user's task intent
     * @returns {Object} - { intent, options: [], bestRecommendation: {} }
     */
    async project(intent) {
        try {
            logger.info(`🔍 Projecting options for intent: "${intent}"`);

            // 1. Get ranked individual bees using CSL
            logger.info(`[Step 1] Routing bees for intent...`);
            const routing = beeFactory.routeBee(intent, { topK: 5, threshold: 0.1 });
            logger.info(`[Step 1] Routing complete. Found ${routing.ranked.length} candidates.`);
            
            // 2. Discover available Swarms
            logger.info(`[Step 2] Listing domains from registry...`);
            const allBees = registry.listDomains();
            logger.info(`[Step 2] Found ${allBees.length} total domains.`);
            const swarms = allBees.filter(b => b.domain.startsWith('swarm-') || b.description.toLowerCase().includes('swarm'));
            logger.info(`[Step 2] Filtered to ${swarms.length} swarms.`);

            // 3. Score Swarms against intent (Simplified CSL matching)
            logger.info(`[Step 3] Scoring swarms...`);
            const swarmOptions = swarms.map(s => {
                const score = this._calculateSimpleResonance(intent, s.domain + ' ' + s.description);
                return {
                    type: 'swarm',
                    id: s.domain,
                    description: s.description,
                    resonance: +score.toFixed(4),
                    composite: +(score * 0.9).toFixed(4) // Swarms slightly penalized in raw score if not precise
                };
            }).sort((a, b) => b.composite - a.composite).slice(0, 3);
            logger.info(`[Step 3] Swarm scoring complete.`);

            // 4. Combine and format options
            let options = [];
            try {
                options = [
                    ...routing.ranked.map(r => ({
                        type: 'bee',
                        id: r.domain,
                        description: r.description,
                        resonance: r.resonance,
                        priority: r.priority,
                        composite: +(r.resonance * (r.priority || 0.5)).toFixed(4)
                    })),
                    ...swarmOptions
                ].sort((a, b) => b.composite - a.composite);
                logger.info(`[Step 4] Combined ${options.length} options.`);
            } catch (err) {
                logger.error(`[Step 4] Failed to combine options: ${err.message}`);
                options = [...swarmOptions];
            }

            const projection = {
                intent,
                ts: Date.now(),
                options,
                recommendation: options[0] || null,
                csl: routing.csl
            };

            return projection;
        } catch (err) {
            logger.error(`Projection fatal error: ${err.message}`);
            return {
                intent,
                ts: Date.now(),
                options: [],
                error: err.message
            };
        }
    }

    /**
     * Simple keyword-based resonance fallback for swarms (if vector is missing).
     */
    _calculateSimpleResonance(intent, target) {
        const iWords = intent.toLowerCase().split(/\s+/);
        const tWords = target.toLowerCase().split(/\s+/);
        let matches = 0;
        for (const w of iWords) {
            if (w.length < 3) continue;
            if (tWords.includes(w)) matches++;
        }
        return matches / Math.max(1, iWords.length);
    }

    getWork(ctx = {}) {
        return [
            async () => {
                const intent = ctx.intent || ctx.task || ctx.query;
                if (!intent) return { status: 'error', reason: 'No intent provided for projection' };
                const result = await this.project(intent);
                return { status: 'ok', projection: result };
            }
        ];
    }
}

const instance = new PreTaskProjectionBee();
module.exports = { 
    domain: instance.domain,
    description: instance.description,
    priority: instance.priority,
    getWork: (ctx) => instance.getWork(ctx),
    project: (intent) => instance.project(intent)
};
