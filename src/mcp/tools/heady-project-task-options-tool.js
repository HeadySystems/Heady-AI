/*
 * © 2026 Heady™Systems Inc. PROPRIETARY AND CONFIDENTIAL.
 */

"use strict";

const projectionBee = require('../../bees/pre-task-projection-bee');
const registry = require('../../bees/registry');

/**
 * MCP Tool Handler for Option Projection
 * 
 * @param {Object} args - { intent: string }
 * @returns {Promise<Object>} - MCP Tool Result
 */
async function handler(args) {
    if (!args.intent) {
        throw new Error('Intent is required for option projection.');
    }

    try {
        // Ensure registry is discovered (lazy init)
        registry.discover();

        const result = await projectionBee.project(args.intent);
        
        const output = {
            intent: result.intent,
            recommendation: result.recommendation ? {
                id: result.recommendation.id,
                type: result.recommendation.type,
                description: result.recommendation.description,
                score: result.recommendation.composite
            } : null,
            available_options: result.options.map(opt => ({
                id: opt.id,
                type: opt.type,
                description: opt.description,
                resonance: opt.resonance,
                composite_score: opt.composite
            }))
        };

        const text = `Heady™ Option Projection — Pre-Task Intent Analysis\n` +
                     `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                     `Intent: "${args.intent}"\n\n` +
                     `Best Match: ${output.recommendation ? `${output.recommendation.id} [${output.recommendation.type}]` : 'N/A'}\n` +
                     `Resonance: ${output.recommendation ? output.recommendation.score.toFixed(4) : '0.0000'}\n\n` +
                     `Available Execution Paths:\n` +
                     output.available_options.map((o, i) => `${i+1}. [${o.type.toUpperCase()}] ${o.id.padEnd(25)} | Score: ${o.composite_score.toFixed(4)}`).join('\n') +
                     `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                     `Heady™ Auto-Success Engine: Selecting optimal resonance path.`;

        return {
            success: true,
            projection: output,
            text
        };
    } catch (error) {
        return {
            success: false,
            error: `Option Projection Failed: ${error.message}`
        };
    }
}

module.exports = { handler };
