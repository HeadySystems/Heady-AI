/**
 * k6-mcp-tools.js — Heady MCP Tool Response Time Benchmark
 *
 * Tests MCP tool invocation latency across 6 tool groups derived from
 * services/heady-mcp-server/src/tools/registry.js.
 *
 * Tool Groups (from registry.js categories):
 *   1. Intelligence  — heady_deep_scan, heady_soul, heady_vinci
 *   2. Memory        — heady_memory, heady_embed
 *   3. Analysis      — heady_analyze, heady_patterns
 *   4. Execution     — heady_coder, heady_battle, heady_refactor
 *   5. Orchestration — heady_auto_flow
 *   6. Security      — heady_risks
 *
 * Thresholds (phi-derived):
 *   - p99 < 1618ms (phi * 1000)
 *   - p95 < 987ms  (FIB[16])
 *   - p50 < 377ms  (FIB[13])
 *
 * Usage:
 *   k6 run k6-mcp-tools.js
 *   HEADY_AUTH_TOKEN=<token> MCP_BASE_URL=https://mcp-server-xxx.run.app k6 run k6-mcp-tools.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

// ─── Phi Constants ───────────────────────────────────────────────────────────
const PHI = 1.618033988749895;
const PSI = 0.618033988749895;
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597];

// ─── Custom Metrics ──────────────────────────────────────────────────────────
const mcpLatency = new Trend('mcp_tool_latency', true);
const mcpErrors = new Rate('mcp_tool_errors');
const mcpInvocations = new Counter('mcp_invocations_total');

// Per-group metrics
const intelligenceLatency = new Trend('group_intelligence_latency', true);
const memoryLatency = new Trend('group_memory_latency', true);
const analysisLatency = new Trend('group_analysis_latency', true);
const executionLatency = new Trend('group_execution_latency', true);
const orchestrationLatency = new Trend('group_orchestration_latency', true);
const securityLatency = new Trend('group_security_latency', true);

// ─── Configuration ──────────────────────────────────────────────────────────
export const options = {
  vus: 100,
  duration: '30s',

  thresholds: {
    // Overall MCP tool latency (cognitive workloads)
    'mcp_tool_latency': [
      'p(50)<377',    // FIB[13] = 377ms
      'p(95)<987',    // FIB[16] = 987ms
      'p(99)<1618',   // phi * 1000 = 1618ms
    ],

    // Intelligence group (heady_deep_scan, heady_soul, heady_vinci)
    'group_intelligence_latency': [
      'p(99)<1618',   // phi * 1000
    ],

    // Memory group (heady_memory, heady_embed)
    'group_memory_latency': [
      'p(50)<89',     // FIB[10] — memory ops should be fast
      'p(99)<610',    // FIB[14]
    ],

    // Analysis group (heady_analyze, heady_patterns)
    'group_analysis_latency': [
      'p(99)<1618',   // phi * 1000
    ],

    // Execution group (heady_coder, heady_battle, heady_refactor)
    'group_execution_latency': [
      'p(99)<1618',   // phi * 1000
    ],

    // Orchestration group (heady_auto_flow) — full pipeline, lenient
    'group_orchestration_latency': [
      'p(99)<2618',   // phi^2 * 1000 = 2618ms
    ],

    // Security group (heady_risks)
    'group_security_latency': [
      'p(99)<987',    // FIB[16] — security checks should be fast
    ],

    // Error rate
    'mcp_tool_errors': ['rate<0.05'],  // 5% for tool invocations (more tolerant)
  },

  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(50)', 'p(90)', 'p(95)', 'p(99)'],
};

// ─── MCP Server URL ─────────────────────────────────────────────────────────
const GCP_PROJECT_NUM = '609590223909';
const REGION = 'us-east1';

function getMcpBaseUrl() {
  if (__ENV.MCP_BASE_URL) {
    return __ENV.MCP_BASE_URL.replace(/\/$/, '');
  }
  return `https://mcp-server-${GCP_PROJECT_NUM}.${REGION}.run.app`;
}

const MCP_BASE_URL = getMcpBaseUrl();

// ─── Tool Group Definitions ─────────────────────────────────────────────────
// 6 groups derived from services/heady-mcp-server/src/tools/registry.js
// and services/heady-mcp-server/tools/tool-registry.js

const TOOL_GROUPS = [
  // Group 1: Intelligence (Tier 0 — critical path)
  {
    name: 'intelligence',
    tools: [
      {
        toolName: 'heady_deep_scan',
        args: { directory: '/tmp/benchmark-test', maxDepth: 1 },
        description: 'Deep project scanning',
      },
      {
        toolName: 'heady_soul',
        args: { content: 'Benchmark test content for coherence evaluation', action: 'analyze' },
        description: 'Soul awareness layer',
      },
      {
        toolName: 'heady_vinci',
        args: { data: 'Benchmark test data for reasoning', action: 'predict' },
        description: 'Vinci session planner',
      },
    ],
    latencyMetric: intelligenceLatency,
  },

  // Group 2: Memory (Tier 0 — critical path)
  {
    name: 'memory',
    tools: [
      {
        toolName: 'heady_memory',
        args: { query: 'benchmark test query', limit: 3, minScore: 0.5 },
        description: 'Vector memory search',
      },
      {
        toolName: 'heady_embed',
        args: { text: 'Benchmark test embedding text', model: 'nomic-embed-text' },
        description: '384D vector embedding',
      },
    ],
    latencyMetric: memoryLatency,
  },

  // Group 3: Analysis (Tier 1)
  {
    name: 'analysis',
    tools: [
      {
        toolName: 'heady_analyze',
        args: { content: 'function benchmarkTest() { return true; }', type: 'code', language: 'javascript' },
        description: 'Unified analysis',
      },
      {
        toolName: 'heady_patterns',
        args: { code: 'class Singleton { static instance; }', action: 'analyze', language: 'javascript' },
        description: 'Pattern detection',
      },
    ],
    latencyMetric: analysisLatency,
  },

  // Group 4: Execution (Tier 1)
  {
    name: 'execution',
    tools: [
      {
        toolName: 'heady_coder',
        args: { prompt: 'Create a health check endpoint', action: 'generate', language: 'javascript' },
        description: 'Code generation',
      },
      {
        toolName: 'heady_battle',
        args: { action: 'leaderboard' },
        description: 'Battle arena leaderboard',
      },
      {
        toolName: 'heady_refactor',
        args: { code: 'var x = 1; var y = 2; var z = x + y;', language: 'javascript' },
        description: 'Code refactoring',
      },
    ],
    latencyMetric: executionLatency,
  },

  // Group 5: Orchestration (Tier 0 — full pipeline)
  {
    name: 'orchestration',
    tools: [
      {
        toolName: 'heady_auto_flow',
        args: { task: 'Benchmark test task for pipeline measurement' },
        description: 'Full auto-success pipeline',
      },
    ],
    latencyMetric: orchestrationLatency,
  },

  // Group 6: Security (Tier 1)
  {
    name: 'security',
    tools: [
      {
        toolName: 'heady_risks',
        args: { content: 'eval(userInput)', action: 'assess', scope: 'all' },
        description: 'Risk assessment',
      },
    ],
    latencyMetric: securityLatency,
  },
];

// Flatten for round-robin iteration
const ALL_TOOLS = [];
for (const grp of TOOL_GROUPS) {
  for (const tool of grp.tools) {
    ALL_TOOLS.push({
      ...tool,
      groupName: grp.name,
      latencyMetric: grp.latencyMetric,
    });
  }
}

// ─── Auth Headers ────────────────────────────────────────────────────────────
function getHeaders() {
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'heady-benchmark/1.0',
  };
  if (__ENV.HEADY_AUTH_TOKEN) {
    headers['Authorization'] = `Bearer ${__ENV.HEADY_AUTH_TOKEN}`;
  }
  return headers;
}

// ─── MCP JSON-RPC Invocation ────────────────────────────────────────────────
function invokeMcpTool(toolDef) {
  // MCP protocol: JSON-RPC 2.0 over HTTP
  const payload = JSON.stringify({
    jsonrpc: '2.0',
    id: `bench-${__VU}-${__ITER}`,
    method: 'tools/call',
    params: {
      name: toolDef.toolName,
      arguments: toolDef.args,
    },
  });

  const params = {
    headers: getHeaders(),
    timeout: '10s',
    tags: {
      tool: toolDef.toolName,
      group: toolDef.groupName,
    },
  };

  const res = http.post(`${MCP_BASE_URL}/mcp`, payload, params);
  const duration = res.timings.duration;

  // Record in overall and group-specific metrics
  mcpLatency.add(duration, { tool: toolDef.toolName });
  mcpInvocations.add(1);
  toolDef.latencyMetric.add(duration, { tool: toolDef.toolName });

  const passed = check(res, {
    [`${toolDef.toolName} status 2xx`]: (r) => r.status >= 200 && r.status < 300,
    [`${toolDef.toolName} valid JSON-RPC response`]: (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.jsonrpc === '2.0' && (body.result !== undefined || body.error !== undefined);
      } catch (_) {
        return false;
      }
    },
    [`${toolDef.toolName} no JSON-RPC error`]: (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.error === undefined;
      } catch (_) {
        return false;
      }
    },
  });

  if (!passed) {
    mcpErrors.add(1);
  } else {
    mcpErrors.add(0);
  }
}

// ─── Main Test Function ─────────────────────────────────────────────────────
export default function () {
  // Round-robin through all tools across all groups
  const toolIndex = __ITER % ALL_TOOLS.length;
  const toolDef = ALL_TOOLS[toolIndex];

  group(`mcp_${toolDef.groupName}`, function () {
    invokeMcpTool(toolDef);
  });

  // Phi-scaled think time (slightly longer for cognitive workloads)
  sleep(PHI * PSI);
}

// ─── Summary Handler ────────────────────────────────────────────────────────
export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputPath = `results/mcp-tools-${timestamp}.json`;

  const lines = [
    '═══════════════════════════════════════════════════════════════',
    '  HEADY MCP TOOL BENCHMARK RESULTS',
    `  Timestamp: ${new Date().toISOString()}`,
    `  VUs: ${options.vus} | Duration: ${options.duration}`,
    `  MCP Server: ${MCP_BASE_URL}`,
    '═══════════════════════════════════════════════════════════════',
    '',
  ];

  const metrics = data.metrics;

  if (metrics.mcp_tool_latency) {
    const vals = metrics.mcp_tool_latency.values;
    lines.push('  Overall MCP Tool Latency:');
    lines.push(`    p50:  ${vals['p(50)'].toFixed(2)}ms  (threshold: <377ms)`);
    lines.push(`    p95:  ${vals['p(95)'].toFixed(2)}ms  (threshold: <987ms)`);
    lines.push(`    p99:  ${vals['p(99)'].toFixed(2)}ms  (threshold: <1618ms)`);
    lines.push(`    avg:  ${vals.avg.toFixed(2)}ms`);
    lines.push(`    max:  ${vals.max.toFixed(2)}ms`);
    lines.push('');
  }

  const groupNames = [
    'intelligence', 'memory', 'analysis',
    'execution', 'orchestration', 'security',
  ];

  for (const gName of groupNames) {
    const key = `group_${gName}_latency`;
    if (metrics[key]) {
      const vals = metrics[key].values;
      lines.push(`  ${gName.toUpperCase()} GROUP:`);
      lines.push(`    p50:  ${vals['p(50)'].toFixed(2)}ms`);
      lines.push(`    p95:  ${vals['p(95)'].toFixed(2)}ms`);
      lines.push(`    p99:  ${vals['p(99)'].toFixed(2)}ms`);
      lines.push('');
    }
  }

  if (metrics.mcp_tool_errors) {
    const errorRate = (metrics.mcp_tool_errors.values.rate * 100).toFixed(2);
    lines.push(`  Error Rate: ${errorRate}%  (threshold: <5%)`);
  }

  if (metrics.mcp_invocations_total) {
    lines.push(`  Total Invocations: ${metrics.mcp_invocations_total.values.count}`);
  }

  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════');

  const summary = lines.join('\n');

  return {
    [outputPath]: JSON.stringify(data, null, 2),
    stdout: summary + '\n',
  };
}
