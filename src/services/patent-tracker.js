'use strict';
/**
 * Patent Tracker — Heady IP Portfolio Management
 *
 * Tracks 72 patents across the Heady Sovereign AI Platform.
 * Provides keyword search, status tracking, and competitive differentiation scoring.
 *
 * Patent zones:
 *   - Sacred Geometry Engine (PHI/Fibonacci-driven orchestration)
 *   - Liquid Latent OS (memory tiers, autocontext, cognitive runtime)
 *   - HCFullPipeline (deterministic pipeline, checkpoint protocol)
 *   - CSL Reasoning (cosine-similarity logic gates)
 *   - Multi-Agent Orchestration (swarm, conductor, battle-sim)
 *   - Auto-Success Heartbeat (135-task self-awareness)
 *   - HeadyBuddy (conversational AI companion)
 *   - HeadyVinci (creative engine, visual generation)
 *   - Sacred Geometry SDK (design tokens, spatial embedding)
 *   - Edge AI & Deployment (cloud-run, CF workers, edge diffusion)
 *
 * (c) 2024-2026 HeadySystems Inc. All Rights Reserved.
 */

const PHI = 1.6180339887498948;

// ─── PATENT DATABASE (72 patents) ────────────────────────────────────────────

const PATENTS = [
  // Sacred Geometry Engine (8 patents)
  { id: 'PAT-SG-001', title: 'Phi-Scaled Task Scheduling Using Golden Ratio Intervals', zone: 'sacred-geometry', filingDate: '2024-03-15', status: 'provisional', claims: 24, priority: 'critical' },
  { id: 'PAT-SG-002', title: 'Fibonacci-Derived Concurrency Limits for Distributed Systems', zone: 'sacred-geometry', filingDate: '2024-04-02', status: 'provisional', claims: 18, priority: 'high' },
  { id: 'PAT-SG-003', title: 'Sacred Geometry Design Token Generation from Mathematical Constants', zone: 'sacred-geometry', filingDate: '2024-05-10', status: 'provisional', claims: 15, priority: 'high' },
  { id: 'PAT-SG-004', title: 'Phi-Backoff Retry Strategy with Golden Ratio Exponential Decay', zone: 'sacred-geometry', filingDate: '2024-06-01', status: 'filed', claims: 12, priority: 'critical' },
  { id: 'PAT-SG-005', title: 'Torus-Mapped Memory Architecture for Spatial Computing', zone: 'sacred-geometry', filingDate: '2024-07-18', status: 'provisional', claims: 21, priority: 'high' },
  { id: 'PAT-SG-006', title: 'Metatron Cube Coordinate System for Multi-Dimensional Agent Routing', zone: 'sacred-geometry', filingDate: '2024-08-22', status: 'provisional', claims: 19, priority: 'medium' },
  { id: 'PAT-SG-007', title: 'Golden Spiral Layout Algorithm for Organic UI Generation', zone: 'sacred-geometry', filingDate: '2024-09-14', status: 'provisional', claims: 16, priority: 'medium' },
  { id: 'PAT-SG-008', title: 'Phi-Harmonic Frequency Allocation for Event Bus Systems', zone: 'sacred-geometry', filingDate: '2024-10-05', status: 'provisional', claims: 14, priority: 'high' },

  // Liquid Latent OS (8 patents)
  { id: 'PAT-LL-001', title: 'Three-Tier Vector Memory Architecture with Phi-Scaled Promotion', zone: 'liquid-latent-os', filingDate: '2024-03-20', status: 'filed', claims: 28, priority: 'critical' },
  { id: 'PAT-LL-002', title: 'AutoContext Universal Intelligence Middleware with 5-Pass Enrichment', zone: 'liquid-latent-os', filingDate: '2024-04-15', status: 'filed', claims: 22, priority: 'critical' },
  { id: 'PAT-LL-003', title: 'Cognitive Runtime Governor with Dynamic Resource Allocation', zone: 'liquid-latent-os', filingDate: '2024-05-22', status: 'provisional', claims: 20, priority: 'high' },
  { id: 'PAT-LL-004', title: 'Buddy Kernel Boot Protocol with Sacred Geometry Frontmatter', zone: 'liquid-latent-os', filingDate: '2024-06-10', status: 'provisional', claims: 17, priority: 'high' },
  { id: 'PAT-LL-005', title: 'Liquid State Machine with Phi-Weighted Transition Probabilities', zone: 'liquid-latent-os', filingDate: '2024-07-08', status: 'provisional', claims: 19, priority: 'high' },
  { id: 'PAT-LL-006', title: 'Confidence Decay Model Using Phi-Exponential Half-Life', zone: 'liquid-latent-os', filingDate: '2024-08-15', status: 'provisional', claims: 13, priority: 'medium' },
  { id: 'PAT-LL-007', title: 'Cross-Device Memory Synchronization with Vector Compaction', zone: 'liquid-latent-os', filingDate: '2024-09-20', status: 'provisional', claims: 16, priority: 'medium' },
  { id: 'PAT-LL-008', title: 'Latent Boundary Controller for Memory Tier Isolation', zone: 'liquid-latent-os', filingDate: '2024-10-12', status: 'provisional', claims: 11, priority: 'medium' },

  // HCFullPipeline (8 patents)
  { id: 'PAT-HC-001', title: 'Deterministic Multi-Stage Pipeline with Checkpoint Protocol', zone: 'hcfullpipeline', filingDate: '2024-03-10', status: 'filed', claims: 30, priority: 'critical' },
  { id: 'PAT-HC-002', title: 'Self-Healing Pipeline with Automatic Stage Recovery', zone: 'hcfullpipeline', filingDate: '2024-04-08', status: 'filed', claims: 25, priority: 'critical' },
  { id: 'PAT-HC-003', title: 'Configuration Drift Detection with Hash-Based Verification', zone: 'hcfullpipeline', filingDate: '2024-05-18', status: 'provisional', claims: 18, priority: 'high' },
  { id: 'PAT-HC-004', title: 'Operational Readiness Scoring with Phi-Weighted Probes', zone: 'hcfullpipeline', filingDate: '2024-06-25', status: 'provisional', claims: 15, priority: 'high' },
  { id: 'PAT-HC-005', title: 'Pipeline DAG Optimizer with Fibonacci-Bounded Parallelism', zone: 'hcfullpipeline', filingDate: '2024-07-30', status: 'provisional', claims: 20, priority: 'high' },
  { id: 'PAT-HC-006', title: 'Seeded Randomness Protocol for Deterministic Distributed Execution', zone: 'hcfullpipeline', filingDate: '2024-08-28', status: 'provisional', claims: 14, priority: 'medium' },
  { id: 'PAT-HC-007', title: 'Circuit Breaker with Phi-Scaled Recovery Timeout', zone: 'hcfullpipeline', filingDate: '2024-09-15', status: 'provisional', claims: 12, priority: 'medium' },
  { id: 'PAT-HC-008', title: 'Resource Policy Engine with YAML-Driven Governance', zone: 'hcfullpipeline', filingDate: '2024-10-20', status: 'provisional', claims: 16, priority: 'medium' },

  // CSL Reasoning (8 patents)
  { id: 'PAT-CSL-001', title: 'Cosine Similarity Logic Gates for Neural Reasoning', zone: 'csl-reasoning', filingDate: '2024-04-01', status: 'filed', claims: 26, priority: 'critical' },
  { id: 'PAT-CSL-002', title: 'Sigmoid-Gated Information Flow with Phi-Tuned Temperature', zone: 'csl-reasoning', filingDate: '2024-05-05', status: 'provisional', claims: 20, priority: 'critical' },
  { id: 'PAT-CSL-003', title: 'Geometric AND/OR/NOT Operations on Embedding Vectors', zone: 'csl-reasoning', filingDate: '2024-06-12', status: 'provisional', claims: 22, priority: 'high' },
  { id: 'PAT-CSL-004', title: 'CSL Threshold Hierarchy Derived from Phi Powers', zone: 'csl-reasoning', filingDate: '2024-07-20', status: 'provisional', claims: 15, priority: 'high' },
  { id: 'PAT-CSL-005', title: 'Ternary Logic System with Cosine-Similarity Confidence Scoring', zone: 'csl-reasoning', filingDate: '2024-08-10', status: 'provisional', claims: 18, priority: 'high' },
  { id: 'PAT-CSL-006', title: 'CSL-Gated Router for Multi-Model Ensemble Selection', zone: 'csl-reasoning', filingDate: '2024-09-08', status: 'provisional', claims: 14, priority: 'medium' },
  { id: 'PAT-CSL-007', title: 'Semantic Backpressure Control Using CSL Score Thresholds', zone: 'csl-reasoning', filingDate: '2024-10-15', status: 'provisional', claims: 12, priority: 'medium' },
  { id: 'PAT-CSL-008', title: 'Cross-Model Verification via CSL Agreement Scoring', zone: 'csl-reasoning', filingDate: '2024-11-01', status: 'provisional', claims: 16, priority: 'medium' },

  // Multi-Agent Orchestration (8 patents)
  { id: 'PAT-MA-001', title: 'Swarm Intelligence Coordinator with Consensus Voting', zone: 'multi-agent', filingDate: '2024-04-10', status: 'filed', claims: 24, priority: 'critical' },
  { id: 'PAT-MA-002', title: 'Battle-Simulation Pipeline for Agent Strategy Optimization', zone: 'multi-agent', filingDate: '2024-05-15', status: 'provisional', claims: 22, priority: 'high' },
  { id: 'PAT-MA-003', title: 'Seventeen-Agent Swarm Topology with Fibonacci Fan-Out', zone: 'multi-agent', filingDate: '2024-06-20', status: 'provisional', claims: 19, priority: 'high' },
  { id: 'PAT-MA-004', title: 'Agent Marketplace with Revenue-Sharing Fee Structure', zone: 'multi-agent', filingDate: '2024-07-25', status: 'provisional', claims: 16, priority: 'high' },
  { id: 'PAT-MA-005', title: 'Skill-Based Agent Routing with CSL Matching Score', zone: 'multi-agent', filingDate: '2024-08-18', status: 'provisional', claims: 14, priority: 'medium' },
  { id: 'PAT-MA-006', title: 'Conductor Pattern for Hierarchical Agent Orchestration', zone: 'multi-agent', filingDate: '2024-09-25', status: 'provisional', claims: 18, priority: 'high' },
  { id: 'PAT-MA-007', title: 'Monte Carlo Strategy Optimizer for Multi-Agent Systems', zone: 'multi-agent', filingDate: '2024-10-10', status: 'provisional', claims: 15, priority: 'medium' },
  { id: 'PAT-MA-008', title: 'Agent Identity Protocol with Cryptographic Attestation', zone: 'multi-agent', filingDate: '2024-11-05', status: 'provisional', claims: 12, priority: 'medium' },

  // Auto-Success Heartbeat (8 patents)
  { id: 'PAT-AS-001', title: 'Self-Awareness Engine with 144-Task Continuous Heartbeat', zone: 'auto-success', filingDate: '2024-04-20', status: 'filed', claims: 26, priority: 'critical' },
  { id: 'PAT-AS-002', title: 'Error-as-Learning Pattern for Zero-Downtime Self-Healing', zone: 'auto-success', filingDate: '2024-05-28', status: 'provisional', claims: 20, priority: 'critical' },
  { id: 'PAT-AS-003', title: 'Phi-Timed Task Cycle with Golden Ratio Interval Scheduling', zone: 'auto-success', filingDate: '2024-06-30', status: 'provisional', claims: 18, priority: 'high' },
  { id: 'PAT-AS-004', title: 'Event-Driven Reactor Pattern for Instantaneous System Response', zone: 'auto-success', filingDate: '2024-07-22', status: 'provisional', claims: 15, priority: 'high' },
  { id: 'PAT-AS-005', title: 'Terminal State Machine for Guaranteed Task Resolution', zone: 'auto-success', filingDate: '2024-08-25', status: 'provisional', claims: 14, priority: 'medium' },
  { id: 'PAT-AS-006', title: 'Pattern Reinforcement with Phi-Weighted Exponential Moving Average', zone: 'auto-success', filingDate: '2024-09-30', status: 'provisional', claims: 12, priority: 'medium' },
  { id: 'PAT-AS-007', title: 'Cross-Category Task Correlation with Fibonacci Window', zone: 'auto-success', filingDate: '2024-10-25', status: 'provisional', claims: 16, priority: 'medium' },
  { id: 'PAT-AS-008', title: 'Unified Scheduler Bridge for Competing Execution Loops', zone: 'auto-success', filingDate: '2025-01-15', status: 'provisional', claims: 20, priority: 'high' },

  // HeadyBuddy (4 patents)
  { id: 'PAT-BB-001', title: 'Conversational AI Companion with Personality Persistence', zone: 'buddy', filingDate: '2024-05-01', status: 'filed', claims: 22, priority: 'high' },
  { id: 'PAT-BB-002', title: 'Socratic Dialogue Protocol for Guided Discovery', zone: 'buddy', filingDate: '2024-06-15', status: 'provisional', claims: 16, priority: 'medium' },
  { id: 'PAT-BB-003', title: 'Buddy Response Quality Sampling with Phi-Rate Selection', zone: 'buddy', filingDate: '2024-08-01', status: 'provisional', claims: 12, priority: 'medium' },
  { id: 'PAT-BB-004', title: 'Cross-Session Memory Consolidation for Companion AI', zone: 'buddy', filingDate: '2024-09-18', status: 'provisional', claims: 14, priority: 'medium' },

  // HeadyVinci (4 patents)
  { id: 'PAT-VN-001', title: 'Creative Engine with Sacred Geometry Aesthetic Constraints', zone: 'vinci', filingDate: '2024-05-20', status: 'provisional', claims: 20, priority: 'high' },
  { id: 'PAT-VN-002', title: 'Phi-Proportioned Visual Composition Algorithm', zone: 'vinci', filingDate: '2024-07-10', status: 'provisional', claims: 16, priority: 'medium' },
  { id: 'PAT-VN-003', title: 'Multi-Model Creative Pipeline with Quality CSL Gate', zone: 'vinci', filingDate: '2024-09-05', status: 'provisional', claims: 14, priority: 'medium' },
  { id: 'PAT-VN-004', title: 'Narrative Story Driver with Coherence Scoring', zone: 'vinci', filingDate: '2024-10-28', status: 'provisional', claims: 12, priority: 'medium' },

  // Sacred Geometry SDK (4 patents)
  { id: 'PAT-SDK-001', title: 'Phi-Derived CSS Custom Properties Generator for Design Systems', zone: 'sacred-geometry-sdk', filingDate: '2024-06-05', status: 'provisional', claims: 18, priority: 'high' },
  { id: 'PAT-SDK-002', title: 'Octree-Based Spatial Memory Manager with Golden Ratio Subdivision', zone: 'sacred-geometry-sdk', filingDate: '2024-07-15', status: 'provisional', claims: 16, priority: 'high' },
  { id: 'PAT-SDK-003', title: 'Template Engine with Phi-Proportioned Layout Generation', zone: 'sacred-geometry-sdk', filingDate: '2024-09-10', status: 'provisional', claims: 14, priority: 'medium' },
  { id: 'PAT-SDK-004', title: 'Capacity Planning Algorithm Using Fibonacci Sequence Bounds', zone: 'sacred-geometry-sdk', filingDate: '2024-10-30', status: 'provisional', claims: 12, priority: 'medium' },

  // Edge AI & Deployment (8 patents)
  { id: 'PAT-EA-001', title: 'Edge Diffusion Engine for Distributed AI Inference', zone: 'edge-ai', filingDate: '2024-04-25', status: 'provisional', claims: 22, priority: 'high' },
  { id: 'PAT-EA-002', title: 'Cloud Run Auto-Scaling with Phi-Derived Instance Counts', zone: 'edge-ai', filingDate: '2024-06-08', status: 'provisional', claims: 16, priority: 'high' },
  { id: 'PAT-EA-003', title: 'Cloudflare Worker Orchestration with Sacred Geometry Routing', zone: 'edge-ai', filingDate: '2024-07-28', status: 'provisional', claims: 14, priority: 'medium' },
  { id: 'PAT-EA-004', title: 'MCP Protocol Extension for AI-Native Tool Communication', zone: 'edge-ai', filingDate: '2024-08-30', status: 'provisional', claims: 20, priority: 'critical' },
  { id: 'PAT-EA-005', title: 'Silicon Bridge for Hardware-Accelerated AI Inference', zone: 'edge-ai', filingDate: '2024-09-22', status: 'provisional', claims: 18, priority: 'high' },
  { id: 'PAT-EA-006', title: 'Phi-Weighted Load Balancing Across Heterogeneous Edge Nodes', zone: 'edge-ai', filingDate: '2024-10-18', status: 'provisional', claims: 15, priority: 'medium' },
  { id: 'PAT-EA-007', title: 'Canary Rollout Protocol with Fibonacci Percentage Stages', zone: 'edge-ai', filingDate: '2024-11-08', status: 'provisional', claims: 14, priority: 'medium' },
  { id: 'PAT-EA-008', title: 'MIDI-over-MCP Protocol for AI Music Collaboration', zone: 'edge-ai', filingDate: '2024-12-01', status: 'provisional', claims: 16, priority: 'medium' },

  // Platform (4 patents)
  { id: 'PAT-PL-001', title: 'Sovereign AI Platform with Full Data Ownership Guarantee', zone: 'platform', filingDate: '2024-03-01', status: 'filed', claims: 32, priority: 'critical' },
  { id: 'PAT-PL-002', title: 'Decentralized Governance Engine for AI Platform Policy', zone: 'platform', filingDate: '2024-05-25', status: 'provisional', claims: 20, priority: 'high' },
  { id: 'PAT-PL-003', title: 'HeadyRegistry Component Catalog with Version Tracking', zone: 'platform', filingDate: '2024-08-05', status: 'provisional', claims: 14, priority: 'medium' },
  { id: 'PAT-PL-004', title: 'Observability Kernel with Phi-Sampled Telemetry', zone: 'platform', filingDate: '2024-10-22', status: 'provisional', claims: 16, priority: 'medium' },
];

// ─── PATENT TRACKER CLASS ────────────────────────────────────────────────────

class PatentTracker {
  constructor() {
    this._patents = [...PATENTS];
    this._zones = [...new Set(PATENTS.map(p => p.zone))];
  }

  /** Total patent count */
  get count() { return this._patents.length; }

  /** Get all patents */
  getAll() { return this._patents; }

  /** Get patent by ID */
  getById(id) { return this._patents.find(p => p.id === id) || null; }

  /** Search patents by keyword in title or zone */
  search(keyword) {
    const kw = keyword.toLowerCase();
    return this._patents.filter(p =>
      p.title.toLowerCase().includes(kw) ||
      p.zone.toLowerCase().includes(kw) ||
      p.id.toLowerCase().includes(kw)
    );
  }

  /** Get patents by zone */
  getByZone(zone) { return this._patents.filter(p => p.zone === zone); }

  /** Get patents by status */
  getByStatus(status) { return this._patents.filter(p => p.status === status); }

  /** Get patents by priority */
  getByPriority(priority) { return this._patents.filter(p => p.priority === priority); }

  /** Get all zones */
  getZones() { return this._zones; }

  /** Total claim count across all patents */
  getTotalClaims() { return this._patents.reduce((s, p) => s + p.claims, 0); }

  /** Competitive differentiation score per zone (0-1) */
  getZoneDifferentiationScore(zone) {
    const zonePatents = this.getByZone(zone);
    if (zonePatents.length === 0) return 0;
    const priorityWeights = { critical: 1.0, high: PHI - 1, medium: Math.pow(PHI - 1, 2), low: Math.pow(PHI - 1, 3) };
    const statusWeights = { filed: 1.0, provisional: PHI - 1, granted: PHI, pending: 0.5 };
    let score = 0;
    let maxScore = 0;
    for (const p of zonePatents) {
      const pw = priorityWeights[p.priority] || 0.3;
      const sw = statusWeights[p.status] || 0.5;
      const claimFactor = Math.min(p.claims / 30, 1); // normalized to max 30 claims
      score += pw * sw * claimFactor;
      maxScore += 1.0 * PHI * 1.0; // max possible per patent
    }
    return maxScore > 0 ? parseFloat((score / maxScore).toFixed(4)) : 0;
  }

  /** Overall portfolio competitive differentiation score */
  getPortfolioScore() {
    const zoneScores = {};
    for (const zone of this._zones) {
      zoneScores[zone] = this.getZoneDifferentiationScore(zone);
    }
    const avg = Object.values(zoneScores).reduce((s, v) => s + v, 0) / this._zones.length;
    return {
      overall: parseFloat(avg.toFixed(4)),
      zones: zoneScores,
      totalPatents: this._patents.length,
      totalClaims: this.getTotalClaims(),
      statusBreakdown: {
        filed: this.getByStatus('filed').length,
        provisional: this.getByStatus('provisional').length,
        granted: this.getByStatus('granted').length,
      },
      priorityBreakdown: {
        critical: this.getByPriority('critical').length,
        high: this.getByPriority('high').length,
        medium: this.getByPriority('medium').length,
      },
    };
  }

  /** Get summary stats */
  getStats() {
    return {
      total: this._patents.length,
      zones: this._zones.length,
      totalClaims: this.getTotalClaims(),
      avgClaimsPerPatent: parseFloat((this.getTotalClaims() / this._patents.length).toFixed(1)),
      filedCount: this.getByStatus('filed').length,
      provisionalCount: this.getByStatus('provisional').length,
      criticalCount: this.getByPriority('critical').length,
    };
  }
}

module.exports = { PatentTracker, PATENTS };
