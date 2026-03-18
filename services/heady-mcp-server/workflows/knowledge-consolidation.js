/**
 * Knowledge Consolidation Workflow
 * Promotes episodic → semantic, compresses old memories with phi-decay,
 * identifies knowledge gaps, generates insight reports.
 * @module knowledge-consolidation
 * © 2026 HeadySystems Inc. — Eric Haywood, Founder
 */
'use strict';

const PHI = 1.618033988749895;
const PSI = 0.618033988749895;
const FIB = [0,1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987];
const CSL = { MINIMUM: 0.500, LOW: 0.691, MEDIUM: 0.809, HIGH: 0.882, CRITICAL: 0.927, DEDUP: 0.972 };

class KnowledgeConsolidationWorkflow {
  constructor(config = {}) {
    this.episodicMax = config.episodicMax || FIB[16]; // 987
    this.semanticMax = config.semanticMax || FIB[15]; // 610
    this.proceduralMax = config.proceduralMax || FIB[14]; // 377
    this.phiDecayHalfLife = config.phiDecayHalfLife || FIB[8] * 3600000; // 21 hours
    this.state = 'IDLE';
  }

  /**
   * Execute full knowledge consolidation cycle
   * @param {object} memory — { episodic: [], semantic: [], procedural: [] }
   * @returns {object} — consolidation report
   */
  async execute(memory) {
    const { episodic = [], semantic = [], procedural = [] } = memory;
    this.state = 'CONSOLIDATING';
    const correlationId = `consolidate-${Date.now().toString(36)}`;
    const now = Date.now();

    // Phase 1: Apply phi-decay to all memories
    const decayedEpisodic = this._applyPhiDecay(episodic, now);
    const decayedSemantic = this._applyPhiDecay(semantic, now);

    // Phase 2: Promote episodic → semantic (repeated patterns become knowledge)
    const promotions = this._promoteEpisodicToSemantic(decayedEpisodic, decayedSemantic);

    // Phase 3: Extract procedural rules from semantic patterns
    const newProcedural = this._extractProceduralRules(decayedSemantic, procedural);

    // Phase 4: Compress old memories
    const compressed = this._compressMemories(decayedEpisodic, decayedSemantic);

    // Phase 5: Identify knowledge gaps
    const gaps = this._identifyKnowledgeGaps(decayedSemantic);

    // Phase 6: Generate insight report
    const insights = this._generateInsightReport(promotions, newProcedural, gaps);

    this.state = 'IDLE';
    return {
      correlationId,
      promotions: { count: promotions.length, items: promotions.slice(0, FIB[8]) },
      newRules: { count: newProcedural.length, items: newProcedural.slice(0, FIB[8]) },
      compression: compressed,
      gaps: { count: gaps.length, items: gaps.slice(0, FIB[8]) },
      insights,
      memorySizes: {
        episodic: { before: episodic.length, after: compressed.episodicRemaining },
        semantic: { before: semantic.length, after: semantic.length + promotions.length },
        procedural: { before: procedural.length, after: procedural.length + newProcedural.length }
      },
      coherence: this._calculateConsolidationCoherence(promotions, gaps),
      timestamp: new Date().toISOString()
    };
  }

  /** Apply phi-decay forgetting curve to memories */
  _applyPhiDecay(memories, now) {
    return memories.map(m => {
      const age = now - (m.timestamp || m.createdAt || now);
      const decayFactor = Math.pow(PSI, age / this.phiDecayHalfLife);
      const decayedRelevance = (m.relevance || m.score || CSL.MEDIUM) * decayFactor;
      return { ...m, originalRelevance: m.relevance || m.score || CSL.MEDIUM, decayedRelevance, age, decayFactor };
    }).sort((a, b) => b.decayedRelevance - a.decayedRelevance);
  }

  /** Promote repeated episodic patterns to semantic knowledge */
  _promoteEpisodicToSemantic(episodic, semantic) {
    const promotions = [];
    const patternCounts = new Map();

    for (const mem of episodic) {
      const key = mem.type || mem.category || 'general';
      patternCounts.set(key, (patternCounts.get(key) || 0) + 1);
    }

    for (const [pattern, count] of patternCounts) {
      if (count >= FIB[4]) { // 3+ repetitions = promote
        const relatedMemories = episodic.filter(m => (m.type || m.category || 'general') === pattern);
        const avgRelevance = relatedMemories.reduce((s, m) => s + m.decayedRelevance, 0) / relatedMemories.length;

        if (avgRelevance >= CSL.LOW) {
          promotions.push({
            pattern,
            occurrences: count,
            avgRelevance,
            promotedAt: Date.now(),
            type: 'semantic-knowledge',
            confidence: Math.min(1.0, avgRelevance * (1 + Math.log(count) * PSI * 0.1))
          });
        }
      }
    }
    return promotions;
  }

  /** Extract procedural rules from semantic knowledge */
  _extractProceduralRules(semantic, existing) {
    const newRules = [];
    const existingKeys = new Set(existing.map(r => r.pattern || r.id));

    // Find if-then patterns in semantic knowledge
    for (let i = 0; i < semantic.length; i++) {
      for (let j = i + 1; j < Math.min(semantic.length, i + FIB[8]); j++) {
        const a = semantic[i];
        const b = semantic[j];
        // If two semantic items are temporally close and both high-relevance
        if (Math.abs((a.timestamp || 0) - (b.timestamp || 0)) < FIB[8] * 60000) {
          if (a.decayedRelevance >= CSL.MEDIUM && b.decayedRelevance >= CSL.MEDIUM) {
            const ruleKey = `${a.type || 'A'}→${b.type || 'B'}`;
            if (!existingKeys.has(ruleKey)) {
              newRules.push({
                id: ruleKey,
                pattern: ruleKey,
                condition: a.type || 'condition',
                action: b.type || 'action',
                confidence: (a.decayedRelevance + b.decayedRelevance) / 2,
                extractedAt: Date.now()
              });
              existingKeys.add(ruleKey);
            }
          }
        }
      }
    }
    return newRules.slice(0, this.proceduralMax);
  }

  /** Compress old low-relevance memories */
  _compressMemories(episodic, semantic) {
    const episodicThreshold = episodic.length > this.episodicMax ? episodic[this.episodicMax].decayedRelevance : CSL.MINIMUM;
    const episodicRetained = episodic.filter(m => m.decayedRelevance >= Math.max(CSL.MINIMUM, episodicThreshold));
    const episodicDropped = episodic.length - episodicRetained.length;
    return { episodicRemaining: episodicRetained.length, episodicDropped, compressionRatio: episodic.length > 0 ? episodicRetained.length / episodic.length : 1.0 };
  }

  /** Identify gaps in knowledge coverage */
  _identifyKnowledgeGaps(semantic) {
    const gaps = [];
    const categories = new Map();
    for (const m of semantic) {
      const cat = m.type || m.category || 'general';
      if (!categories.has(cat)) categories.set(cat, []);
      categories.get(cat).push(m);
    }

    // Expected categories based on 9 Heady domains + core systems
    const expected = ['code','security','architecture','research','creative','documentation','monitoring','deployment','memory','trading','governance','community','companion','api','mcp'];
    for (const exp of expected) {
      if (!categories.has(exp) || categories.get(exp).length < FIB[4]) {
        gaps.push({ category: exp, currentKnowledge: (categories.get(exp) || []).length, minimumExpected: FIB[4], severity: categories.has(exp) ? CSL.LOW : CSL.MEDIUM });
      }
    }
    return gaps;
  }

  _generateInsightReport(promotions, newRules, gaps) {
    return {
      summary: `Consolidated ${promotions.length} patterns into knowledge, extracted ${newRules.length} new rules, identified ${gaps.length} knowledge gaps`,
      topPromotion: promotions[0] || null,
      topRule: newRules[0] || null,
      criticalGaps: gaps.filter(g => g.severity >= CSL.MEDIUM),
      overallMaturity: gaps.length === 0 ? 'mature' : gaps.length <= FIB[4] ? 'developing' : 'immature'
    };
  }

  _calculateConsolidationCoherence(promotions, gaps) {
    const promotionScore = Math.min(1.0, promotions.length * 0.05);
    const gapPenalty = gaps.length * 0.03;
    return Math.max(CSL.MINIMUM, CSL.MEDIUM + promotionScore - gapPenalty);
  }

  health() {
    return { status: 'ok', workflow: 'knowledge-consolidation', state: this.state, timestamp: new Date().toISOString() };
  }
}

module.exports = { KnowledgeConsolidationWorkflow };
