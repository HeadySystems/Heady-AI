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
     * Project options for a task intent.
     * 
     * @param {string} intent - The user's task description
     * @returns {Object} - { intent, options: [], bestRecommendation: {} }
     */
    async project(intent) {
        logger.info(`🔍 Projecting options for intent: "${intent}"`);

        // 1. Get ranked individual bees using CSL
        const routing = beeFactory.routeBee(intent, { topK: 5, threshold: 0.1 });
        
        // 2. Discover available Swarms
        const allBees = registry.listDomains();
        const swarms = allBees.filter(b => b.domain.startsWith('swarm-') || b.description.toLowerCase().includes('swarm'));

        // 3. Score Swarms against intent (Simplified CSL matching)
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

        // 4. Combine and format options
        const options = [
            ...routing.ranked.map(r => ({
                type: 'bee',
                id: r.domain,
                description: r.description,
                resonance: r.resonance,
                priority: r.priority,
                composite: r.composite
            })),
            ...swarmOptions
        ].sort((a, b) => b.composite - a.composite);

        const projection = {
            intent,
            ts: Date.now(),
            options,
            recommendation: options[0] || null,
            csl: routing.csl
        };

        return projection;
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
