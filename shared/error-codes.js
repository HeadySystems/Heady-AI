/**
 * Heady Error Codes — Auto-generated from ERROR_CODES.md
 * Eric Haywood — Sacred Geometry v4.0
 */
'use strict';

const HEADY_ERRORS = {
  'AUTH_001': { code: 'HEADY-AUTH-001', http: 401, message: 'Invalid or expired session token' },
  'AUTH_002': { code: 'HEADY-AUTH-002', http: 403, message: 'Insufficient permissions' },
  'AUTH_003': { code: 'HEADY-AUTH-003', http: 429, message: 'Authentication rate limit exceeded' },
  'AUTH_004': { code: 'HEADY-AUTH-004', http: 401, message: 'Invalid Firebase ID token' },
  'AUTH_005': { code: 'HEADY-AUTH-005', http: 403, message: 'Cross-domain session mismatch' },
  'BRAIN_001': { code: 'HEADY-BRAIN-001', http: 503, message: 'LLM provider unavailable' },
  'BRAIN_002': { code: 'HEADY-BRAIN-002', http: 408, message: 'Inference timeout exceeded' },
  'BRAIN_003': { code: 'HEADY-BRAIN-003', http: 429, message: 'Model rate limit reached' },
  'BRAIN_004': { code: 'HEADY-BRAIN-004', http: 400, message: 'Invalid prompt template' },
  'BRAIN_005': { code: 'HEADY-BRAIN-005', http: 500, message: 'Model output failed schema validation' },
  'MEMORY_001': { code: 'HEADY-MEMORY-001', http: 503, message: 'pgvector connection pool exhausted' },
  'MEMORY_002': { code: 'HEADY-MEMORY-002', http: 400, message: 'Invalid embedding dimensions (expected 384)' },
  'MEMORY_003': { code: 'HEADY-MEMORY-003', http: 404, message: 'Vector not found in memory' },
  'MEMORY_004': { code: 'HEADY-MEMORY-004', http: 500, message: 'HNSW index corruption detected' },
  'MEMORY_005': { code: 'HEADY-MEMORY-005', http: 429, message: 'Embedding rate limit exceeded' },
  'GATEWAY_001': { code: 'HEADY-GATEWAY-001', http: 502, message: 'Upstream service unreachable' },
  'GATEWAY_002': { code: 'HEADY-GATEWAY-002', http: 429, message: 'API rate limit exceeded (phi-scaled window)' },
  'GATEWAY_003': { code: 'HEADY-GATEWAY-003', http: 503, message: 'Bulkhead capacity full' },
  'GATEWAY_004': { code: 'HEADY-GATEWAY-004', http: 408, message: 'Request timeout (4.236s exceeded)' },
  'GATEWAY_005': { code: 'HEADY-GATEWAY-005', http: 400, message: 'Invalid API version' },
  'BEE_001': { code: 'HEADY-BEE-001', http: 500, message: 'Bee spawn failure' },
  'BEE_002': { code: 'HEADY-BEE-002', http: 408, message: 'Bee execution timeout' },
  'BEE_003': { code: 'HEADY-BEE-003', http: 503, message: 'Swarm capacity exceeded (10,000 limit)' },
  'BEE_004': { code: 'HEADY-BEE-004', http: 500, message: 'Bee retirement cleanup failed' },
  'BEE_005': { code: 'HEADY-BEE-005', http: 409, message: 'Bee ID conflict in registry' },
  'PIPELINE_001': { code: 'HEADY-PIPELINE-001', http: 500, message: 'HCFullPipeline stage failure' },
  'PIPELINE_002': { code: 'HEADY-PIPELINE-002', http: 408, message: 'Pipeline execution timeout (21 stages)' },
  'PIPELINE_003': { code: 'HEADY-PIPELINE-003', http: 409, message: 'Pipeline already running for this context' },
  'PIPELINE_004': { code: 'HEADY-PIPELINE-004', http: 500, message: 'Arena mode scoring failure' },
  'PIPELINE_005': { code: 'HEADY-PIPELINE-005', http: 400, message: 'Invalid pipeline configuration' },
  'CSL_001': { code: 'HEADY-CSL-001', http: 400, message: 'CSL gate threshold not met' },
  'CSL_002': { code: 'HEADY-CSL-002', http: 500, message: 'Vector dimension mismatch in CSL operation' },
  'CSL_003': { code: 'HEADY-CSL-003', http: 400, message: 'Invalid ternary logic mode' },
  'CSL_004': { code: 'HEADY-CSL-004', http: 500, message: 'HDC codebook overflow (capacity: 96 items at 384-dim)' },
  'CSL_005': { code: 'HEADY-CSL-005', http: 400, message: 'Cosine similarity out of range' },
  'NATS_001': { code: 'HEADY-NATS-001', http: 503, message: 'NATS JetStream connection lost' },
  'NATS_002': { code: 'HEADY-NATS-002', http: 500, message: 'Message delivery failed after phi^3 retries' },
  'NATS_003': { code: 'HEADY-NATS-003', http: 400, message: 'Invalid NATS subject format' },
  'NATS_004': { code: 'HEADY-NATS-004', http: 503, message: 'Stream storage limit reached' },
  'NATS_005': { code: 'HEADY-NATS-005', http: 500, message: 'Consumer group rebalance in progress' },
};

module.exports = { HEADY_ERRORS };
