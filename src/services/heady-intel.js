// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ INTEL — Competitive Intelligence & Patent Dashboard    ║
// ║  Weekly AI-generated market intelligence reports                ║
// ║  FILE: src/services/heady-intel.js                             ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const yaml = require('js-yaml');
const logger = require('../utils/logger');

const PHI = 1.618033988749895;
const ROOT = path.resolve(__dirname, '..', '..');

// ─── Patent Tracker ─────────────────────────────────────────────────

class PatentTracker {
  constructor() {
    this.patents = [];
    this._loadRegistry();
  }

  _loadRegistry() {
    const registryPaths = [
      path.join(ROOT, 'configs', 'patent-registry-standardized.yaml'),
      path.join(ROOT, 'configs', 'ip-registry.yaml'),
    ];

    for (const p of registryPaths) {
      if (fs.existsSync(p)) {
        try {
          const data = yaml.load(fs.readFileSync(p, 'utf8'));
          if (!data) continue;

          // Handle patent-registry-standardized.yaml format (multiple batch keys)
          const batchKeys = ['batch_4_patents', 'march_2026_batch', 'foundational_patents'];
          for (const key of batchKeys) {
            if (Array.isArray(data[key])) {
              for (const patent of data[key]) {
                this.patents.push({
                  id: patent.id || patent.patent_id || patent.name,
                  title: patent.title || patent.name,
                  status: patent.status || 'provisional',
                  category: patent.category || patent.domain || 'general',
                  filingDate: patent.filing_date || patent.filingDate,
                  claims: patent.claims || patent.claim_count,
                });
              }
            }
          }

          // Handle direct patents array
          if (Array.isArray(data.patents)) {
            this.patents.push(...data.patents);
          }

          // Handle ip-registry.yaml owned_ip format
          if (Array.isArray(data.owned_ip)) {
            for (const ip of data.owned_ip) {
              this.patents.push({
                id: ip.id || ip.name,
                title: ip.name || ip.title,
                status: ip.status || 'provisional',
                category: ip.category || 'general',
                filingDate: ip.filing_date || ip.filingDate,
              });
            }
          }
        } catch (err) {
          logger.error('Unexpected error', { error: err.message, stack: err.stack });
        }
      }
    }
  }

  getAll() {
    return this.patents;
  }

  getByStatus(status) {
    return this.patents.filter(p => p.status === status);
  }

  getByCategory(category) {
    return this.patents.filter(p => p.category === category);
  }

  getSummary() {
    const byStatus = {};
    const byCategory = {};
    for (const p of this.patents) {
      byStatus[p.status] = (byStatus[p.status] || 0) + 1;
      byCategory[p.category] = (byCategory[p.category] || 0) + 1;
    }
    return { total: this.patents.length, byStatus, byCategory };
  }
}

// ─── Competitor Tracker ─────────────────────────────────────────────

class CompetitorTracker {
  constructor() {
    this.competitors = [
      { id: 'cursor', name: 'Cursor', category: 'AI IDE', strengths: ['code-completion', 'inline-edits'], weaknesses: ['no-pipeline', 'no-sacred-geometry'] },
      { id: 'windsurf', name: 'Windsurf/Codeium', category: 'AI IDE', strengths: ['cascade-flow', 'large-context'], weaknesses: ['no-self-awareness', 'no-governance'] },
      { id: 'github-copilot', name: 'GitHub Copilot', category: 'AI Assistant', strengths: ['marketplace-reach', 'github-integration'], weaknesses: ['no-agent-swarms', 'no-battle-arena'] },
      { id: 'devin', name: 'Devin', category: 'AI Agent', strengths: ['autonomous-execution', 'web-browsing'], weaknesses: ['no-multi-model-routing', 'no-phi-constants'] },
      { id: 'replit', name: 'Replit Agent', category: 'Cloud IDE', strengths: ['instant-deployment', 'collaboration'], weaknesses: ['limited-offline', 'no-self-critique'] },
      { id: 'claude-code', name: 'Claude Code', category: 'AI CLI', strengths: ['terminal-native', 'agentic-tools'], weaknesses: ['no-web-ui', 'single-model'] },
      { id: 'v0', name: 'Vercel v0', category: 'UI Generator', strengths: ['design-generation', 'nextjs-integration'], weaknesses: ['no-backend', 'no-orchestration'] },
      { id: 'bolt', name: 'Bolt.new', category: 'Fullstack Generator', strengths: ['fast-prototyping', 'deploy-in-browser'], weaknesses: ['no-enterprise-features', 'no-governance'] },
    ];
    this.featureComparisons = [];
  }

  getAll() {
    return this.competitors;
  }

  compareFeature(feature) {
    const heady = this._hasFeature(feature);
    const comparison = this.competitors.map(c => ({
      competitor: c.name,
      hasFeature: c.strengths.some(s => s.includes(feature.toLowerCase())),
    }));
    return { feature, heady: heady, competitors: comparison };
  }

  _hasFeature(feature) {
    const headyFeatures = [
      'sacred-geometry', 'phi-constants', 'csl-scoring', 'multi-model-routing',
      'agent-swarms', 'battle-arena', 'monte-carlo', 'self-awareness',
      'self-critique', 'governance', 'kill-switch', 'audit-trail',
      'hallucination-watchdog', '22-stage-pipeline', 'auto-success',
      'vector-memory', 'tenant-isolation', 'spaced-repetition',
    ];
    return headyFeatures.some(f => f.includes(feature.toLowerCase()));
  }

  getDifferentiators() {
    return [
      { feature: 'Sacred Geometry Design System', uniqueToHeady: true, patentProtected: true },
      { feature: 'CSL (Cosine Similarity Logic) Gates', uniqueToHeady: true, patentProtected: true },
      { feature: '22-Stage Self-Aware Pipeline', uniqueToHeady: true, patentProtected: true },
      { feature: 'Phi-Scaled Fibonacci Architecture', uniqueToHeady: true, patentProtected: true },
      { feature: 'Multi-Candidate Battle Arena', uniqueToHeady: true, patentProtected: true },
      { feature: 'Governance Kill-Switch + Audit Trail', uniqueToHeady: true, patentProtected: false },
      { feature: 'Auto-Success 598-Task Engine', uniqueToHeady: true, patentProtected: true },
      { feature: 'Bee Swarm Agent Orchestration', uniqueToHeady: true, patentProtected: true },
    ];
  }
}

// ─── Intelligence Report Generator ──────────────────────────────────

class IntelReportGenerator {
  constructor(patentTracker, competitorTracker) {
    this.patents = patentTracker;
    this.competitors = competitorTracker;
    this.reports = [];
  }

  generateWeeklyReport() {
    const report = {
      id: `intel_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      type: 'weekly',
      generatedAt: new Date().toISOString(),
      sections: {
        patentSummary: this.patents.getSummary(),
        competitorLandscape: {
          tracked: this.competitors.getAll().length,
          competitors: this.competitors.getAll().map(c => ({
            name: c.name,
            category: c.category,
            threatLevel: c.strengths.length > 2 ? 'medium' : 'low',
          })),
        },
        differentiators: this.competitors.getDifferentiators(),
        recommendations: this._generateRecommendations(),
        marketPosition: {
          category: 'Sovereign AI Platform',
          uniquePosition: 'Only platform combining Sacred Geometry + Multi-Agent Swarms + Self-Aware Pipeline',
          moatStrength: 'strong',
          patentCoverage: this.patents.getSummary().total,
        },
      },
    };

    this.reports.push(report);
    return report;
  }

  _generateRecommendations() {
    return [
      { priority: 1, action: 'File utility patents for CSL gate composition methods', impact: 'Strengthen IP moat' },
      { priority: 2, action: 'Publish Sacred Geometry SDK benchmark vs Material/Tailwind', impact: 'Market differentiation' },
      { priority: 3, action: 'Launch HeadyGuard SOC 2 compliance whitepaper', impact: 'Enterprise sales enablement' },
      { priority: 4, action: 'Open-source heady-bee agent framework', impact: 'Community adoption + marketplace growth' },
      { priority: 5, action: 'Integrate Cloudflare AI Gateway for edge LLM routing', impact: 'Latency reduction + cost savings' },
    ];
  }

  getReports(limit = 10) {
    return this.reports.slice(-limit);
  }
}

// ─── Express Router ─────────────────────────────────────────────────

function createIntelRouter() {
  const express = require('express');
  const router = express.Router();
  const patentTracker = new PatentTracker();
  const competitorTracker = new CompetitorTracker();
  const reportGenerator = new IntelReportGenerator(patentTracker, competitorTracker);

  const auth = (req, res, next) => {
    const key = req.headers['x-heady-api-key'] || req.headers['authorization']?.split(' ')[1];
    if (!key || key !== process.env.HEADY_API_KEY) {
      return res.status(403).json({ error: 'API key required' });
    }
    next();
  };

  router.get('/patents', auth, (req, res) => {
    const { status, category } = req.query;
    let patents = patentTracker.getAll();
    if (status) patents = patentTracker.getByStatus(status);
    if (category) patents = patentTracker.getByCategory(category);
    res.json({ ok: true, summary: patentTracker.getSummary(), patents });
  });

  router.get('/competitors', auth, (req, res) => {
    res.json({ ok: true, competitors: competitorTracker.getAll(), differentiators: competitorTracker.getDifferentiators() });
  });

  router.get('/compare/:feature', auth, (req, res) => {
    res.json({ ok: true, comparison: competitorTracker.compareFeature(req.params.feature) });
  });

  router.post('/report/generate', auth, (req, res) => {
    const report = reportGenerator.generateWeeklyReport();
    res.json({ ok: true, report });
  });

  router.get('/reports', auth, (req, res) => {
    res.json({ ok: true, reports: reportGenerator.getReports() });
  });

  router.get('/status', auth, (req, res) => {
    res.json({
      ok: true,
      patents: patentTracker.getSummary(),
      competitors: competitorTracker.getAll().length,
      differentiators: competitorTracker.getDifferentiators().length,
      reportsGenerated: reportGenerator.reports.length,
    });
  });

  return router;
}

module.exports = { createIntelRouter, PatentTracker, CompetitorTracker, IntelReportGenerator };
