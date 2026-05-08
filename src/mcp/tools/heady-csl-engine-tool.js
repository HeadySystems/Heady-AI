/**
 * Heady™ MCP Tool — CSL Engine
 * Provides Continuous Semantic Logic operations (Geometric AI)
 */

'use strict';

const logger = require('../../utils/logger');

let cslEngine = null;

/**
 * Initialize CSLEngine (singleton)
 */
async function getEngine() {
    if (cslEngine) return cslEngine;
    
    try {
        const { CSLEngine } = await import('../../core/csl-engine/csl-engine.js');
        cslEngine = new CSLEngine({
            dim: 384 // Default dimension
        });
        
        logger.info('Heady™ CSL Engine initialized');
        return cslEngine;
    } catch (error) {
        logger.error('Failed to initialize CSL Engine', { error: error.message });
        throw error;
    }
}

/**
 * Tool Handler
 */
async function handler(args) {
    const { operation, a, b, vectors, weights, threshold, mode = 'hard' } = args;
    const engine = await getEngine();
    
    try {
        // Validation: CSL operations require vectors (Float64Array/number[])
        // In the context of an MCP tool call from a user, we might receive text.
        // For this tool to be useful, it should handle text by embedding it first,
        // or accept raw vectors if passed from another tool.
        // For now, we'll assume the input 'a' and 'b' are either vectors or text
        // that we might need to mock if we don't have an embedder here.
        
        // Mock embedder for demonstration (replaces text with 384-dim random unit vector)
        const embed = (val) => {
            if (Array.isArray(val) || val instanceof Float64Array || val instanceof Float32Array) {
                return val;
            }
            if (typeof val === 'string') {
                // Deterministic mock embedding based on string hash
                const seed = val.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0);
                const vec = new Float64Array(384);
                for (let i = 0; i < 384; i++) {
                    vec[i] = Math.sin(seed + i);
                }
                // Normalize
                const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0));
                for (let i = 0; i < 384; i++) vec[i] /= norm;
                return vec;
            }
            throw new Error(`Cannot embed value of type ${typeof val}`);
        };

        switch (operation) {
            case 'and':
            case 'alignment':
                const sim = engine.AND(embed(a), embed(b));
                return {
                    success: true,
                    operation: 'and',
                    score: sim,
                    interpretation: sim > 0.8 ? 'Strong Alignment' : (sim > 0.5 ? 'Moderate Alignment' : 'Low Alignment')
                };
                
            case 'or':
            case 'superposition':
                const union = engine.OR(embed(a), embed(b));
                return {
                    success: true,
                    operation: 'or',
                    result_vector: Array.from(union).slice(0, 10), // Return snippet
                    message: 'Computed semantic superposition'
                };
                
            case 'not':
            case 'negation':
                const negated = engine.NOT(embed(a), embed(b));
                return {
                    success: true,
                    operation: 'not',
                    result_vector: Array.from(negated).slice(0, 10),
                    message: 'Performed semantic negation (orthogonal projection)'
                };
                
            case 'gate':
                const { activation, cosScore } = engine.GATE(embed(a), embed(b), threshold, mode);
                return {
                    success: true,
                    operation: 'gate',
                    activation,
                    score: cosScore,
                    triggered: activation > 0.5
                };
                
            case 'consensus':
                if (!vectors || !Array.isArray(vectors)) throw new Error('Vectors array required for consensus');
                const { consensus, strength } = engine.CONSENSUS(vectors.map(v => embed(v)), weights);
                return {
                    success: true,
                    operation: 'consensus',
                    strength,
                    consensus_snippet: Array.from(consensus).slice(0, 10)
                };

            case 'imply':
                const implication = engine.IMPLY(embed(a), embed(b));
                const strengthVal = engine.IMPLY_scalar(embed(a), embed(b));
                return {
                    success: true,
                    operation: 'imply',
                    strength: strengthVal,
                    message: `Degree to which A implies B: ${strengthVal.toFixed(4)}`
                };

            default:
                throw new Error(`Unsupported operation: ${operation}`);
        }
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = { handler };
