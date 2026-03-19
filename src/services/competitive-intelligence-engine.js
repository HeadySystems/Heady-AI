/**
 * Competitive Intelligence Engine
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * Profiles competitors, scores Heady differentiators, identifies
 * strategic gaps and opportunities using phi-weighted analysis.
 */
'use strict';

const PHI = (1 + Math.sqrt(5)) / 2;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89];

const COMPETITORS = [
  { id: 'langchain', name: 'LangChain', category: 'framework', strengths: ['ecosystem', 'community', 'integrations'], weaknesses: ['complexity', 'performance', 'vendor-lock'] },
  { id: 'crewai', name: 'CrewAI', category: 'agents', strengths: ['multi-agent', 'simplicity'], weaknesses: ['limited-routing', 'no-sacred-geometry', 'no-self-healing'] },
  { id: 'autogen', name: 'AutoGen', category: 'agents', strengths: ['microsoft-backing', 'conversation-patterns'], weaknesses: ['no-pipeline', 'no-vector-memory', 'no-monetization'] },
  { id: 'dify', name: 'Dify', category: 'platform', strengths: ['ui', 'workflow-builder', 'open-source'], weaknesses: ['no-governance', 'no-phi-optimization', 'limited-agents'] },
  { id: 'flowise', name: 'Flowise', category: 'platform', strengths: ['visual-builder', 'open-source'], weaknesses: ['no-enterprise', 'no-pipeline', 'no-billing'] },
  { id: 'superagent', name: 'SuperAgent', category: 'agents', strengths: ['api-first', 'tool-use'], weaknesses: ['no-sacred-geometry', 'no-auto-success', 'limited-orchestration'] },
  { id: 'relevance-ai', name: 'Relevance AI', category: 'platform', strengths: ['no-code', 'templates'], weaknesses: ['no-self-healing', 'no-phi-math', 'limited-customization'] },
  { id: 'dust', name: 'Dust', category: 'platform', strengths: ['enterprise-focus', 'data-sources'], weaknesses: ['no-agent-marketplace', 'no-sacred-geometry', 'closed-ecosystem'] },
];

const HEADY_DIFFERENTIATORS = [
  { id: 'sacred-geometry', name: 'Sacred Geometry Architecture', weight: FIB[10], category: 'ip-moat', description: 'φ-scaled timing, Fibonacci scheduling, torus topology — mathematically harmonious system design' },
  { id: 'hcfullpipeline', name: '22-Stage HCFullPipeline', weight: FIB[9], category: 'ip-moat', description: 'Deterministic, checkpointed pipeline with self-healing and quality gates' },
  { id: 'csl-reasoning', name: 'CSL Geometric Logic', weight: FIB[9], category: 'ip-moat', description: 'Continuous Semantic Logic gates (AND=cos, OR=normalize, NOT=proj, GATE=σ)' },
  { id: 'auto-success', name: 'LAW-07 Auto-Success', weight: FIB[8], category: 'ip-moat', description: '100% success rate guarantee — errors absorbed as learnings, ORS always 100' },
  { id: 'liquid-latent-os', name: 'Liquid Latent OS', weight: FIB[8], category: 'ip-moat', description: '3-tier vector memory (T0/T1/T2), 5-pass AutoContext, CSL gates' },
  { id: 'governance-engine', name: 'GovernanceEngine + Kill-Switch', weight: FIB[7], category: 'enterprise', description: 'Multi-policy enforcement, tamper-evident audit, catastrophic loss kill-switch' },
  { id: 'agent-marketplace', name: 'Agent Marketplace', weight: FIB[7], category: 'monetization', description: 'Third-party agent ecosystem with 20% platform fee' },
  { id: 'multi-tenant-rls', name: 'Multi-Tenant RLS Isolation', weight: FIB[6], category: 'enterprise', description: 'Per-tenant pgvector with RLS, φ-scaled quotas' },
  { id: 'patent-portfolio', name: '72-Patent Portfolio', weight: FIB[6], category: 'ip-moat', description: 'Broad IP coverage across all core technologies' },
  { id: 'vector-memory-3d', name: '3D Vector Memory Space', weight: FIB[5], category: 'ip-moat', description: '384-dim embeddings projected into 3D with octant zoning and HNSW indexes' },
  { id: 'phi-billing', name: 'φ-Scaled Metered Billing', weight: FIB[5], category: 'monetization', description: 'Usage-based + subscription + licensing + platform-fees + consulting' },
  { id: 'self-healing', name: 'Self-Healing Pipeline', weight: FIB[4], category: 'enterprise', description: 'Circuit breakers, auto-rollback, self-heal events' },
  { id: 'spaced-repetition', name: 'Fibonacci Spaced Repetition Training', weight: FIB[4], category: 'intelligence', description: 'Continuous learning with Fibonacci-interval review scheduling' },
];

class CompetitiveIntelligenceEngine {
  constructor() {
    this._competitors = [...COMPETITORS];
    this._differentiators = [...HEADY_DIFFERENTIATORS];
    this._lastScanAt = null;
  }

  scan() {
    this._lastScanAt = new Date().toISOString();
    const results = this._competitors.map(comp => {
      const gaps = this._differentiators.filter(d =>
        comp.weaknesses.some(w => d.id.includes(w.replace('no-', '')) || d.name.toLowerCase().includes(w.replace('no-', '')))
      );
      const threats = comp.strengths.filter(s =>
        this._differentiators.some(d => d.description.toLowerCase().includes(s))
      );
      return {
        competitor: comp.name,
        category: comp.category,
        gapCount: gaps.length,
        gaps: gaps.map(g => g.name),
        threatLevel: threats.length > 2 ? 'high' : threats.length > 0 ? 'medium' : 'low',
        headyAdvantage: this._computeAdvantageScore(comp),
      };
    });
    return { scannedAt: this._lastScanAt, competitors: results };
  }

  _computeAdvantageScore(competitor) {
    const totalWeight = this._differentiators.reduce((s, d) => s + d.weight, 0);
    const gapWeight = this._differentiators
      .filter(d => competitor.weaknesses.some(w => d.id.includes(w.replace('no-', ''))))
      .reduce((s, d) => s + d.weight, 0);
    return Math.round((gapWeight / totalWeight) * 100);
  }

  getMoatScore() {
    const ipMoat = this._differentiators.filter(d => d.category === 'ip-moat');
    const totalWeight = this._differentiators.reduce((s, d) => s + d.weight, 0);
    const ipWeight = ipMoat.reduce((s, d) => s + d.weight, 0);
    return {
      overall: Math.round((ipWeight / totalWeight) * 100),
      patents: 72,
      differentiators: this._differentiators.length,
      ipMoatItems: ipMoat.length,
      categories: { 'ip-moat': ipMoat.length, enterprise: 3, monetization: 2, intelligence: 1 },
    };
  }

  health() {
    return {
      service: 'competitive-intelligence-engine',
      competitors: this._competitors.length,
      differentiators: this._differentiators.length,
      lastScanAt: this._lastScanAt,
      moatScore: this.getMoatScore().overall,
    };
  }
}

module.exports = { CompetitiveIntelligenceEngine, COMPETITORS, HEADY_DIFFERENTIATORS };
