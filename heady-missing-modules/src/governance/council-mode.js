/**
 * HeadyCouncilMode — Multi-Model Consensus Decision Engine
 *
 * When a decision is too important for a single model, Council Mode
 * queries multiple LLM providers simultaneously and synthesizes their
 * responses using CSL CONSENSUS (weighted centroid).
 *
 * This replaces "ask the best model" with "ask all models, find agreement."
 * No single model is ranked above another — consensus emerges from
 * semantic alignment measured by cosine similarity.
 *
 * © 2026 HeadySystems Inc. — Sacred Geometry v4.0
 * @module governance/council-mode
 */

const { PHI, PSI, fib, CSL_THRESHOLDS, phiFusionWeights, cosineSimilarity, cslGate } = require('../shared/phi-math');
const { createLogger } = require('../shared/logger');

const logger = createLogger('CouncilMode');

/**
 * @typedef {Object} CouncilMember
 * @property {string} id - Provider/model identifier
 * @property {string} name - Display name
 * @property {Function} queryFn - async (prompt) => string — query this model
 * @property {Function} embedFn - async (text) => number[] — embed response
 * @property {number} weight - Council weight (default 1.0 — equal standing)
 */

/**
 * @typedef {Object} CouncilVerdict
 * @property {string} consensus - Synthesized consensus response
 * @property {number} agreementScore - How much the council agreed (0-1)
 * @property {number[]} consensusEmbedding - 384D consensus vector
 * @property {Object[]} votes - Individual member responses + scores
 * @property {string[]} dissent - Members who diverged significantly
 * @property {string} confidenceLevel - nominal|low|medium|high|critical
 */

class CouncilMode {
  /**
   * @param {Object} config
   * @param {CouncilMember[]} config.members - Council members (models)
   * @param {Function} config.embedFn - Shared embed function (fallback)
   * @param {number} [config.minMembers] - Minimum members for valid vote (default: fib(4) = 3)
   * @param {number} [config.consensusThreshold] - Min agreement score (default: CSL_THRESHOLDS.MEDIUM)
   * @param {number} [config.timeoutMs] - Per-member timeout (default: PHI * 1000 * fib(8) = ~33,978ms)
   */
  constructor(config) {
    this.members = config.members;
    this.embedFn = config.embedFn;
    this.minMembers = config.minMembers || fib(4);          // 3
    this.consensusThreshold = config.consensusThreshold || CSL_THRESHOLDS.MEDIUM;
    this.timeoutMs = config.timeoutMs || Math.round(PHI * 1000 * fib(8)); // ~33,978ms
    this.verdictHistory = [];
  }

  /**
   * Convene the council — query all members concurrently and synthesize.
   * @param {string} prompt - The question/decision to put before the council
   * @param {Object} [context] - Additional context
   * @param {string} [context.domain] - Domain hint for weighting
   * @param {boolean} [context.requireUnanimity] - Require all to agree
   * @returns {Promise<CouncilVerdict>}
   */
  async convene(prompt, context = {}) {
    if (this.members.length < this.minMembers) {
      throw new Error(`Council requires at least ${this.minMembers} members, got ${this.members.length}`);
    }

    logger.info({ memberCount: this.members.length, prompt: prompt.slice(0, 100) }, 'Council convened');

    // Query all members concurrently
    const memberResponses = await Promise.allSettled(
      this.members.map(member => this._queryMember(member, prompt))
    );

    // Collect successful responses
    const votes = [];
    const failedMembers = [];

    for (let i = 0; i < memberResponses.length; i++) {
      const result = memberResponses[i];
      const member = this.members[i];

      if (result.status === 'fulfilled') {
        votes.push({
          memberId: member.id,
          memberName: member.name,
          response: result.value.response,
          embedding: result.value.embedding,
          weight: member.weight || 1.0,
          latencyMs: result.value.latencyMs,
        });
      } else {
        failedMembers.push(member.id);
        logger.warn({ member: member.id, error: result.reason?.message }, 'Council member failed');
      }
    }

    // Need minimum members
    if (votes.length < this.minMembers) {
      throw new Error(`Only ${votes.length}/${this.minMembers} council members responded`);
    }

    // Compute consensus embedding (weighted centroid)
    const consensusEmbedding = this._computeConsensus(votes);

    // Score each vote's alignment with consensus
    for (const vote of votes) {
      vote.alignmentScore = cosineSimilarity(vote.embedding, consensusEmbedding);
      vote.gatedScore = cslGate(1.0, vote.alignmentScore, CSL_THRESHOLDS.MINIMUM);
    }

    // Overall agreement score — average pairwise alignment
    const agreementScore = this._computeAgreement(votes);

    // Identify dissenting members (below consensus threshold)
    const dissent = votes
      .filter(v => v.alignmentScore < this.consensusThreshold)
      .map(v => v.memberId);

    // Select the response closest to consensus as the "consensus answer"
    votes.sort((a, b) => b.alignmentScore - a.alignmentScore);
    const consensusResponse = votes[0].response;

    // Confidence level based on agreement
    const confidenceLevel = this._classifyConfidence(agreementScore);

    const verdict = {
      consensus: consensusResponse,
      agreementScore: parseFloat(agreementScore.toFixed(4)),
      consensusEmbedding,
      votes: votes.map(v => ({
        memberId: v.memberId,
        memberName: v.memberName,
        response: v.response.slice(0, 500), // Truncate for storage
        alignmentScore: parseFloat(v.alignmentScore.toFixed(4)),
        latencyMs: v.latencyMs,
      })),
      dissent,
      confidenceLevel,
      failedMembers,
      timestamp: new Date().toISOString(),
    };

    // Store verdict
    this.verdictHistory.push(verdict);
    if (this.verdictHistory.length > fib(10)) { // 55 verdicts
      this.verdictHistory = this.verdictHistory.slice(-fib(9)); // Keep 34
    }

    logger.info({
      agreement: verdict.agreementScore,
      confidence: verdict.confidenceLevel,
      responded: votes.length,
      failed: failedMembers.length,
      dissent: dissent.length,
    }, 'Council verdict reached');

    // If unanimity required but not achieved
    if (context.requireUnanimity && dissent.length > 0) {
      logger.warn({ dissent }, 'Unanimity required but not achieved');
      verdict.unanimityFailed = true;
    }

    return verdict;
  }

  /**
   * Query a single council member with timeout.
   * @param {CouncilMember} member
   * @param {string} prompt
   * @returns {Promise<{ response: string, embedding: number[], latencyMs: number }>}
   */
  async _queryMember(member, prompt) {
    const start = Date.now();

    const response = await Promise.race([
      member.queryFn(prompt),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), this.timeoutMs)
      ),
    ]);

    const embedFn = member.embedFn || this.embedFn;
    const embedding = await embedFn(response);
    const latencyMs = Date.now() - start;

    return { response, embedding, latencyMs };
  }

  /**
   * Compute consensus embedding — weighted centroid of all vote embeddings.
   * Uses CSL CONSENSUS: Σ(wᵢ·vᵢ) / ‖Σ(wᵢ·vᵢ)‖
   * @param {Object[]} votes
   * @returns {number[]} Normalized consensus embedding
   */
  _computeConsensus(votes) {
    const dim = votes[0].embedding.length;
    const totalWeight = votes.reduce((s, v) => s + v.weight, 0);
    const sum = new Array(dim).fill(0);

    for (const vote of votes) {
      const w = vote.weight / totalWeight;
      for (let d = 0; d < dim; d++) {
        sum[d] += w * vote.embedding[d];
      }
    }

    // Normalize to unit vector
    const norm = Math.sqrt(sum.reduce((s, v) => s + v * v, 0));
    return norm > 0 ? sum.map(v => v / norm) : sum;
  }

  /**
   * Compute overall agreement — average pairwise cosine similarity.
   * @param {Object[]} votes
   * @returns {number} Agreement score (0-1)
   */
  _computeAgreement(votes) {
    let totalSim = 0;
    let count = 0;

    for (let i = 0; i < votes.length; i++) {
      for (let j = i + 1; j < votes.length; j++) {
        totalSim += cosineSimilarity(votes[i].embedding, votes[j].embedding);
        count++;
      }
    }

    return count > 0 ? totalSim / count : 0;
  }

  /**
   * Classify agreement score into confidence level.
   * @param {number} agreement
   * @returns {string}
   */
  _classifyConfidence(agreement) {
    if (agreement >= CSL_THRESHOLDS.CRITICAL) return 'critical';   // Near-unanimous
    if (agreement >= CSL_THRESHOLDS.HIGH) return 'high';
    if (agreement >= CSL_THRESHOLDS.MEDIUM) return 'medium';
    if (agreement >= CSL_THRESHOLDS.LOW) return 'low';
    return 'nominal';
  }

  /** Health check */
  health() {
    return {
      service: 'CouncilMode',
      status: 'up',
      memberCount: this.members.length,
      verdictCount: this.verdictHistory.length,
      avgAgreement: this.verdictHistory.length > 0
        ? parseFloat((this.verdictHistory.reduce((s, v) => s + v.agreementScore, 0) / this.verdictHistory.length).toFixed(4))
        : null,
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = { CouncilMode };
