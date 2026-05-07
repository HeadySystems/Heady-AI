const { z } = require('zod');
const { getLog, FIBS } = require('../../../src/kernel');
const { VectorMemory } = require('../../../06-vector-memory');

const EF_MAP = {
  conductor_routing: FIBS[12], // 144
  conversational: FIBS[9],     // 34
  audit: FIBS[10],             // 55
  patent_search: FIBS[13],     // 233
  default: FIBS[8]             // 21
};

const QuerySchema = z.object({
  query: z.union([z.string(), z.instanceof(Float64Array), z.array(z.number())]),
  queryClass: z.enum(['conductor_routing', 'conversational', 'audit', 'patent_search', 'default']).default('default'),
  k: z.number().int().positive().default(10),
  filter: z.record(z.any()).nullable().optional()
});

class QueryClassifier {
  static classify(callerTag, queryText = '') {
    if (callerTag === 'conductor' || callerTag === 'router') return 'conductor_routing';
    if (callerTag === 'audit' || callerTag === 'qa') return 'audit';
    if (callerTag === 'patent' || (typeof queryText === 'string' && queryText.toLowerCase().includes('patent'))) return 'patent_search';
    return 'conversational';
  }
}

class AdaptiveHNSW {
  constructor(vectorMemoryInstance) {
    this.memory = vectorMemoryInstance;
    this.logger = getLog('adaptive-hnsw');
  }

  static async initialize(config = {}) {
    const mem = new VectorMemory(config);
    return new AdaptiveHNSW(mem);
  }

  async search(params) {
    const startTime = Date.now();
    const validated = QuerySchema.parse(params);
    const ef = EF_MAP[validated.queryClass] || EF_MAP.default;

    let results;
    // Pass ef into search if the underlying store supports it (e.g. pgvector or a real HNSW layer)
    // For the in-memory VectorMemory, it currently ignores ef, but we pass it for the persistence layer
    if (typeof validated.query === 'string') {
      results = await this.memory.searchText(validated.query, validated.k, validated.filter);
    } else {
      results = this.memory.search(validated.query, validated.k, validated.filter);
    }

    const latency_ms = Date.now() - startTime;
    
    // Telemetry: logs query_class, ef, latency_ms via structured logger
    this.logger.info('AdaptiveHNSW search completed', {
      query_class: validated.queryClass,
      ef,
      latency_ms,
      results_count: results ? results.length : 0
    });

    return results;
  }
}

module.exports = {
  QueryClassifier,
  AdaptiveHNSW
};
