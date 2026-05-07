/**
 * Heady™ Governance — φ-Harmonic Voting
 * 
 * Calculates voting power for node operators based on economic participation
 * and temporal longevity.
 */

'use strict';

const hdc = require('./heady-coin');

class GovernanceService {
    /**
     * Calculate voting power for a node.
     * @param {string} nodeId 
     */
    calculateVotingPower(nodeId) {
        const wallet = hdc.createWallet(nodeId);
        const balance = wallet.balance || 0;
        
        // Age factor: Log-scaled days since creation (simplified)
        const createdAt = new Date(wallet.createdAt);
        const ageDays = Math.max(1, (Date.now() - createdAt) / (1000 * 60 * 60 * 24));
        const ageFactor = Math.log10(ageDays + 1) + 1;

        // φ-harmonic power calculation: Balance raised to the power of 1/φ (0.618)
        const economicPower = Math.pow(balance, 0.618);
        
        const totalPower = economicPower * ageFactor;

        return {
            nodeId,
            balance,
            ageDays: ageDays.toFixed(1),
            votingPower: totalPower.toFixed(4),
            phiScaling: 0.618
        };
    }

    /**
     * Cast a vote on a proposal.
     */
    castVote(nodeId, proposalId, stance) {
        const power = this.calculateVotingPower(nodeId);
        console.log(`🗳️ [Governance] Node ${nodeId} cast ${stance} vote with ${power.votingPower} power on ${proposalId}`);
        // Logic to persist vote...
        return { ok: true, power: power.votingPower };
    }
}

module.exports = new GovernanceService();
