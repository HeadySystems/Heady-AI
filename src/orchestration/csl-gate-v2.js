/**
 * CSL-Gate-V2 — Multi-Vector Intelligence Gating
 * 
 * Hardens the intelligence gateway with precise multi-vector scoring.
 */

'use strict';

class CSLGateV2 {
    /**
     * Score a task request for execution.
     * @param {object} request 
     */
    scoreRequest(request) {
        const { complexity, safety, priority } = request;
        
        // Multi-vector scoring logic
        const complexityWeight = 0.618;
        const safetyWeight = 1.0;
        const priorityWeight = 0.382;

        const totalScore = (complexity * complexityWeight) + (safety * safetyWeight) + (priority * priorityWeight);
        const threshold = 1.618;

        const approved = totalScore >= threshold;
        
        console.log(`🛡️ [CSL-Gate-V2] Request Scored: ${totalScore.toFixed(2)} / Threshold: ${threshold}`);
        console.log(`   └─ Status: ${approved ? 'APPROVED' : 'REJECTED'}`);

        return {
            approved,
            score: totalScore,
            vectors: { complexity, safety, priority }
        };
    }

    /**
     * Route a request to the appropriate LLM cluster.
     */
    route(request, score) {
        if (!score.approved) return 'restricted-baseline';
        
        if (score.score > 3.0) return 'vinci-v2-high-fidelity';
        return 'standard-swarm-reasoning';
    }
}

module.exports = new CSLGateV2();
