// ═══════════════════════════════════════════════════════════════════════════════
// HEADY™ Service Registry — Complete 50-Service Registry (Ports 3310-3396)
// © 2026 HeadySystems Inc. — Eric Haywood, Founder
// ═══════════════════════════════════════════════════════════════════════════════

import { PHI, PSI, PSI3, FIB, CSL_THRESHOLDS, cslGate, cosineSimilarity } from '../shared/phi-math-v2.js';
import { textToEmbedding } from '../shared/csl-engine-v2.js';

const SERVICE_GROUPS = Object.freeze({
  Inference:     { start: 3310, services: ['HeadyInfer', 'HeadyEmbed', 'HeadyEval', 'HeadyPrompt', 'HeadyClassify', 'HeadyNER', 'HeadySummarize', 'HeadyTranslate', 'HeadyVision', 'HeadySpeech'] },
  Memory:        { start: 3320, services: ['HeadyVector', 'HeadyGraph', 'HeadyCache', 'HeadyStore', 'HeadyIndex', 'HeadyArchive', 'HeadySnapshot', 'HeadyReplay', 'HeadyTimeline', 'HeadyContext'] },
  Agents:        { start: 3330, services: ['HeadySwarm', 'HeadyBee', 'HeadyWorker', 'HeadyScheduler', 'HeadyQueue', 'HeadyPool', 'HeadyDispatch', 'HeadyOrchAgent', 'HeadyMonitor', 'HeadyRecover'] },
  Orchestration: { start: 3340, services: ['HeadyConductor', 'HeadyPipeline', 'HeadyRouter', 'HeadyGateway', 'HeadyProxy', 'HeadyLoadBal', 'HeadyCircuit', 'HeadyThrottle', 'HeadyRetry', 'HeadyFallback'] },
  Security:      { start: 3350, services: ['HeadyAuth', 'HeadyRBAC', 'HeadyCrypto', 'HeadyAudit', 'HeadyFirewall'] },
  Monitoring:    { start: 3355, services: ['HeadyHealth', 'HeadyMetrics', 'HeadyTrace', 'HeadyAlert', 'HeadyDashboard'] },
  Web:           { start: 3360, services: ['HeadyWeb', 'HeadyCMS', 'HeadyAPI', 'HeadySSR', 'HeadyStatic', 'HeadyCDN', 'HeadyForm', 'HeadySearch', 'HeadyMedia', 'HeadyChat'] },
  Data:          { start: 3370, services: ['HeadyETL', 'HeadyAnalytics', 'HeadyReport', 'HeadyExport', 'HeadyImport', 'HeadySync', 'HeadyMigrate', 'HeadyBackup', 'HeadyRestore', 'HeadyValidate'] },
  Integration:   { start: 3380, services: ['HeadyMCP', 'HeadyWebhook', 'HeadyOAuth', 'HeadySSO', 'HeadyEmail', 'HeadySMS', 'HeadySlack', 'HeadyGitHub', 'HeadyJira', 'HeadyNotebookLM'] },
  Specialized:   { start: 3390, services: ['HeadyFinance', 'HeadyLegal', 'HeadyHR', 'HeadyMarketing', 'HeadySales', 'HeadySupport', 'HeadyR&D'] },
});

class ServiceRegistry {
  #services;
  #embeddings;

  constructor() {
    this.#services = new Map();
    this.#embeddings = new Map();
    this.#initialize();
  }

  register(name, port, group, metadata = {}) {
    const entry = { name, port, group, status: 'registered', metadata, registeredAt: Date.now() };
    this.#services.set(name, entry);
    this.#embeddings.set(name, textToEmbedding('service:' + name + ':' + group));
    return entry;
  }

  discover(query) {
    const queryEmb = textToEmbedding(query);
    const scored = Array.from(this.#services.entries()).map(([name, svc]) => {
      const emb = this.#embeddings.get(name);
      const score = emb ? cosineSimilarity(queryEmb, emb) : 0;
      return { name, ...svc, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, FIB[6]);
  }

  getServiceMap() {
    const map = {};
    for (const [group, config] of Object.entries(SERVICE_GROUPS)) {
      map[group] = config.services.map((name, i) => ({
        name, port: config.start + i, group,
        status: this.#services.get(name)?.status || 'unknown',
      }));
    }
    return map;
  }

  getGroupHealth(group) {
    const config = SERVICE_GROUPS[group];
    if (!config) return null;
    const services = config.services.map(name => this.#services.get(name)).filter(Boolean);
    const healthy = services.filter(s => s.status === 'registered').length;
    return { group, healthy, total: config.services.length, score: healthy / config.services.length };
  }

  routeTo(query) {
    const results = this.discover(query);
    return results[0] || null;
  }

  getService(name) { return this.#services.get(name) || null; }
  getAllServices() { return Array.from(this.#services.values()); }
  getServiceCount() { return this.#services.size; }

  #initialize() {
    for (const [group, config] of Object.entries(SERVICE_GROUPS)) {
      config.services.forEach((name, i) => {
        this.register(name, config.start + i, group);
      });
    }
  }
}

export { ServiceRegistry, SERVICE_GROUPS };
export default ServiceRegistry;
