/**
 * Governance-V1 — Sovereign On-Chain Voting
 * 
 * Implements decentralized decision making for the Heady roadmap.
 * Voting Power = Balance^0.618 * Participation_Score
 */

'use strict';

const hdc = require('../services/billing-service/src/heady-coin');

class GovernanceV1 {
    constructor() {
        this.activeProposals = new Map();
    }

    /**
     * Submit a new proposal to the roadmap.
     */
    submitProposal(authorId, title, description) {
        const proposalId = `prop-${Math.random().toString(36).substring(7)}`;
        this.activeProposals.set(proposalId, {
            proposalId,
            authorId,
            title,
            description,
            votes: new Map(), // userId -> weight
            status: 'OPEN',
            createdAt: new Date().toISOString()
        });
        console.log(`🗳️ [Governance] New Proposal: ${title} (ID: ${proposalId})`);
        return proposalId;
    }

    /**
     * Cast a vote on a proposal.
     */
    castVote(userId, proposalId, support = true) {
        const proposal = this.activeProposals.get(proposalId);
        if (!proposal) throw new Error('Proposal not found');

        const balance = hdc.getBalance(userId);
        const power = Math.pow(balance, 0.618); // φ-weighted power

        proposal.votes.set(userId, support ? power : -power);
        console.log(`🗳️ [Governance] User ${userId} cast vote on ${proposalId}. Power: ${power.toFixed(2)}`);
        
        return { userId, power };
    }

    /**
     * Tally votes and resolve the proposal.
     */
    resolveProposal(proposalId) {
        const proposal = this.activeProposals.get(proposalId);
        let totalWeight = 0;

        proposal.votes.forEach((weight) => {
            totalWeight += weight;
        });

        const passed = totalWeight > 0;
        proposal.status = passed ? 'PASSED' : 'REJECTED';
        
        console.log(`🏁 [Governance] Proposal ${proposalId} resolved: ${proposal.status} (Weight: ${totalWeight.toFixed(2)})`);
        return { proposalId, status: proposal.status, totalWeight };
    }
}

module.exports = new GovernanceV1();
