// packages/heady-core/src/tenant.js
// §1 — Tenant Namespace Helpers
// All Redis keys scoped under tenant:{id}: to prevent cross-tenant leakage

export const tenantKey = (id, ...parts) =>
  `tenant:${id}:${parts.join(':')}`;

export const sessionKey  = (id) => tenantKey(id, 'session');
export const jobKey      = (id, jobId) => tenantKey(id, 'job', jobId, 'status');
export const memoryKey   = (id) => tenantKey(id, 'memory', 'working');
export const cslKey      = (id) => tenantKey(id, 'csl', 'score');
export const llmCacheKey = (id, hash) => tenantKey(id, 'cache', 'llm', hash);
export const pipelineStreamKey = (id) => tenantKey(id, 'pipeline', 'stream');
