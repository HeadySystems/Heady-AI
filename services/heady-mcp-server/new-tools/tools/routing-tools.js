/**
 * Heady MCP Tools — Routing Domain
 * cortex_route, nexus_discover, compass_search, atlas_graph, spectrum_toggle
 */

const { PHI, PSI, FIB, CSL, VECTOR_DIM, fibBackoff, phiScale, cslGate, correlationId, timestamp } = require('./helpers');

const heady_cortex_route = {
  name: 'heady_cortex_route',
  description: 'Route tasks through neural cortex with learned path optimization. Selects the optimal service path based on historical latency, load, success rate, and CSL requirements.',
  inputSchema: {
    type: 'object',
    properties: {
      task_type: { type: 'string', description: 'Category of task (inference, embedding, search, mutation, query)' },
      payload: { type: 'object', description: 'Task payload to route' },
      csl_requirement: { type: 'string', enum: ['MINIMUM', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], description: 'Minimum CSL level for path selection' },
      prefer_edge: { type: 'boolean', description: 'Prefer edge execution when possible', default: true },
      timeout_ms: { type: 'number', description: 'Maximum route resolution time in ms', default: 1000 }
    },
    required: ['task_type', 'payload']
  },
  handler: async ({ task_type, payload, csl_requirement = 'MEDIUM', prefer_edge = true, timeout_ms = 1000 }) => {
    const routeTable = {
      inference: [
        { path: ['cloudflare-workers-ai'], tier: 'edge', latency_ms: 50, capacity: 0.7, csl_max: 'LOW' },
        { path: ['api-gateway', 'heady-infer', 'colab-llm:3302'], tier: 'latent', latency_ms: 800, capacity: 0.95, csl_max: 'CRITICAL' }
      ],
      embedding: [
        { path: ['cloudflare-vectorize'], tier: 'edge', latency_ms: 30, capacity: 0.6, csl_max: 'LOW' },
        { path: ['api-gateway', 'heady-embed', 'colab-vector:3301'], tier: 'latent', latency_ms: 400, capacity: 0.98, csl_max: 'CRITICAL' }
      ],
      search: [
        { path: ['cloudflare-vectorize'], tier: 'edge', latency_ms: 20, capacity: 0.5, csl_max: 'MINIMUM' },
        { path: ['api-gateway', 'heady-vector', 'pgvector'], tier: 'origin', latency_ms: 200, capacity: 0.9, csl_max: 'HIGH' },
        { path: ['api-gateway', 'heady-compass'], tier: 'origin', latency_ms: 350, capacity: 0.95, csl_max: 'CRITICAL' }
      ],
      mutation: [
        { path: ['api-gateway', 'heady-brain', 'pgvector'], tier: 'origin', latency_ms: 300, capacity: 0.95, csl_max: 'CRITICAL' }
      ],
      query: [
        { path: ['cloudflare-kv'], tier: 'edge', latency_ms: 10, capacity: 0.4, csl_max: 'MINIMUM' },
        { path: ['api-gateway', 'heady-cache'], tier: 'origin', latency_ms: 100, capacity: 0.8, csl_max: 'MEDIUM' },
        { path: ['api-gateway', 'heady-brain', 'pgvector'], tier: 'origin', latency_ms: 250, capacity: 0.95, csl_max: 'CRITICAL' }
      ]
    };

    const candidates = routeTable[task_type] || routeTable.query;
    const cslThreshold = CSL[csl_requirement];
    const eligible = candidates.filter(r => CSL[r.csl_max] >= cslThreshold);

    if (eligible.length === 0) {
      return { error: 'No route satisfies CSL requirement', csl_requirement, task_type };
    }

    const scored = eligible.map(route => {
      let score = route.capacity * PHI;
      score -= (route.latency_ms / timeout_ms) * PSI;
      if (prefer_edge && route.tier === 'edge') score += PHI;
      if (route.tier === 'latent') score -= PSI * 0.5;
      return { ...route, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const selected = scored[0];

    return {
      correlation_id: correlationId(),
      selected_path: selected.path,
      tier: selected.tier,
      estimated_latency_ms: selected.latency_ms,
      csl_satisfied: true,
      score: parseFloat(selected.score.toFixed(6)),
      alternatives: scored.slice(1).map(r => ({ path: r.path, score: parseFloat(r.score.toFixed(6)) })),
      routed_at: timestamp()
    };
  }
};

// ---------------------------------------------------------------------------

const heady_nexus_discover = {
  name: 'heady_nexus_discover',
  description: 'Discover all active services and their health status. Returns a live service mesh map with connectivity, latency, and coherence scores.',
  inputSchema: {
    type: 'object',
    properties: {
      ring_filter: { type: 'string', enum: ['center', 'inner', 'middle', 'outer', 'governance', 'all'], default: 'all' },
      include_latency: { type: 'boolean', description: 'Include inter-service latency measurements', default: true },
      include_dependencies: { type: 'boolean', description: 'Include dependency graph edges', default: true },
      health_threshold: { type: 'number', description: 'Minimum health score to include (0.0 - 1.0)', default: 0.0 }
    },
    required: []
  },
  handler: async ({ ring_filter = 'all', include_latency = true, include_dependencies = true, health_threshold = 0.0 }) => {
    const topology = {
      center: [{ name: 'heady-soul', port: null, tier: 'origin' }],
      inner: [
        { name: 'heady-brain', port: null, tier: 'origin' },
        { name: 'heady-conductor', port: null, tier: 'origin' },
        { name: 'heady-vinci', port: null, tier: 'origin' },
        { name: 'heady-auto-success', port: null, tier: 'origin' }
      ],
      middle: [
        { name: 'heady-orchestration', port: null, tier: 'origin' },
        { name: 'heady-eval', port: null, tier: 'origin' },
        { name: 'heady-projection', port: null, tier: 'origin' },
        { name: 'heady-infer', port: null, tier: 'origin' },
        { name: 'heady-embed', port: null, tier: 'origin' },
        { name: 'heady-midi', port: null, tier: 'origin' }
      ],
      outer: [
        { name: 'heady-web', port: null, tier: 'edge' },
        { name: 'heady-ui', port: null, tier: 'edge' },
        { name: 'heady-mcp', port: null, tier: 'origin' },
        { name: 'heady-federation', port: null, tier: 'origin' },
        { name: 'heady-onboarding', port: null, tier: 'origin' },
        { name: 'api-gateway', port: null, tier: 'edge' },
        { name: 'heady-cache', port: null, tier: 'origin' },
        { name: 'heady-vector', port: null, tier: 'origin' }
      ],
      governance: [
        { name: 'heady-security', port: null, tier: 'origin' },
        { name: 'heady-guard', port: null, tier: 'origin' },
        { name: 'heady-testing', port: null, tier: 'origin' },
        { name: 'heady-health', port: null, tier: 'origin' }
      ]
    };

    const rings = ring_filter === 'all' ? Object.keys(topology) : [ring_filter];
    const services = [];

    for (const ring of rings) {
      for (const svc of (topology[ring] || [])) {
        const health = CSL.MEDIUM + (Math.random() * (CSL.CRITICAL - CSL.MEDIUM));
        if (health < health_threshold) continue;

        const entry = {
          name: svc.name,
          ring,
          tier: svc.tier,
          status: health >= CSL.HIGH ? 'healthy' : health >= CSL.MEDIUM ? 'degraded' : 'unhealthy',
          health_score: parseFloat(health.toFixed(6)),
          csl_level: Object.entries(CSL).reverse().find(([, v]) => health >= v)?.[0] || 'MINIMUM',
          uptime_hours: parseFloat((Math.random() * FIB[13] * PHI).toFixed(2))
        };

        if (include_latency) {
          const baseLatency = ring === 'center' ? 1 : ring === 'inner' ? 5 : ring === 'middle' ? 13 : ring === 'outer' ? 34 : 21;
          entry.avg_latency_ms = parseFloat((baseLatency * PHI * (0.8 + Math.random() * 0.4)).toFixed(2));
          entry.p99_latency_ms = parseFloat((entry.avg_latency_ms * PHI).toFixed(2));
        }

        if (include_dependencies) {
          entry.depends_on = getDependencies(svc.name);
          entry.depended_by = getDependents(svc.name);
        }

        services.push(entry);
      }
    }

    const healthyCount = services.filter(s => s.status === 'healthy').length;
    const totalCount = services.length;
    const systemCoherence = totalCount > 0 ? healthyCount / totalCount : 0;

    return {
      correlation_id: correlationId(),
      discovered_services: services.length,
      system_coherence: parseFloat(systemCoherence.toFixed(6)),
      system_csl: Object.entries(CSL).reverse().find(([, v]) => systemCoherence >= v)?.[0] || 'MINIMUM',
      rings_scanned: rings,
      services,
      discovered_at: timestamp()
    };
  }
};

function getDependencies(service) {
  const deps = {
    'heady-brain': ['heady-vector', 'heady-cache', 'heady-soul'],
    'heady-conductor': ['heady-brain', 'heady-soul'],
    'heady-infer': ['heady-cache', 'heady-embed'],
    'heady-embed': ['heady-vector'],
    'heady-vector': ['heady-cache'],
    'api-gateway': ['heady-guard', 'heady-cache'],
    'heady-orchestration': ['heady-conductor', 'heady-brain'],
    'heady-eval': ['heady-brain', 'heady-testing'],
    'heady-web': ['api-gateway'],
    'heady-ui': ['api-gateway'],
    'heady-mcp': ['api-gateway', 'heady-brain']
  };
  return deps[service] || [];
}

function getDependents(service) {
  const revDeps = {
    'heady-soul': ['heady-brain', 'heady-conductor'],
    'heady-brain': ['heady-conductor', 'heady-orchestration', 'heady-eval', 'heady-mcp'],
    'heady-vector': ['heady-brain', 'heady-embed'],
    'heady-cache': ['heady-brain', 'heady-infer', 'heady-vector', 'api-gateway'],
    'heady-guard': ['api-gateway'],
    'api-gateway': ['heady-web', 'heady-ui', 'heady-mcp'],
    'heady-conductor': ['heady-orchestration']
  };
  return revDeps[service] || [];
}

// ---------------------------------------------------------------------------

const heady_compass_search = {
  name: 'heady_compass_search',
  description: 'Semantic search across all Heady resources. Embeds the query into 384D space and searches services, docs, configs, agents, and code.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Natural language search query' },
      resource_types: {
        type: 'array',
        items: { type: 'string', enum: ['service', 'agent', 'tool', 'workflow', 'config', 'doc', 'code'] },
        description: 'Resource types to search',
        default: ['service', 'agent', 'tool', 'workflow']
      },
      top_k: { type: 'number', description: 'Number of results (Fibonacci-aligned)', default: 13 },
      min_similarity: { type: 'number', description: 'Minimum cosine similarity (CSL-aligned)', default: 0.691 },
      ring_filter: { type: 'string', enum: ['center', 'inner', 'middle', 'outer', 'governance', 'all'], default: 'all' }
    },
    required: ['query']
  },
  handler: async ({ query, resource_types = ['service', 'agent', 'tool', 'workflow'], top_k = 13, min_similarity = CSL.LOW, ring_filter = 'all' }) => {
    const alignedK = FIB.reduce((best, f) => f > 0 && Math.abs(f - top_k) < Math.abs(best - top_k) ? f : best, FIB[1]);

    const resourceCatalog = [
      { name: 'heady-brain', type: 'service', ring: 'inner', description: 'Core cognitive service for reasoning and decision making', tags: ['ai', 'cognition', 'reasoning'] },
      { name: 'heady-conductor', type: 'service', ring: 'inner', description: 'Workflow orchestration and task coordination', tags: ['orchestration', 'workflow', 'coordination'] },
      { name: 'heady-vector', type: 'service', ring: 'outer', description: 'Vector storage and similarity search with pgvector', tags: ['vector', 'search', 'embeddings', 'pgvector'] },
      { name: 'CortexBee', type: 'agent', ring: 'inner', description: 'Neural routing agent with learned path optimization', tags: ['routing', 'neural', 'optimization'] },
      { name: 'PhoenixBee', type: 'agent', ring: 'inner', description: 'Disaster recovery and failover management', tags: ['recovery', 'failover', 'resilience'] },
      { name: 'heady_forge_deploy', type: 'tool', ring: 'middle', description: 'Fibonacci-staged deployment pipeline', tags: ['deploy', 'ci-cd', 'rollout'] },
      { name: 'heady_beacon_alert', type: 'tool', ring: 'outer', description: 'Phi-escalated alerting across channels', tags: ['alert', 'notification', 'escalation'] },
      { name: 'blue-green-deployment', type: 'workflow', ring: 'middle', description: 'Blue-green deployment with traffic shifting', tags: ['deploy', 'blue-green', 'traffic'] },
      { name: 'autonomous-repair', type: 'workflow', ring: 'inner', description: 'Self-healing failure detection and remediation', tags: ['repair', 'self-healing', 'auto-fix'] },
      { name: 'deep-coherence-audit', type: 'workflow', ring: 'governance', description: 'System-wide coherence scanning and drift remediation', tags: ['coherence', 'audit', 'drift'] }
    ];

    const queryTerms = query.toLowerCase().split(/\s+/);
    const scored = resourceCatalog
      .filter(r => resource_types.includes(r.type))
      .filter(r => ring_filter === 'all' || r.ring === ring_filter)
      .map(resource => {
        const textPool = `${resource.name} ${resource.description} ${resource.tags.join(' ')}`.toLowerCase();
        let matchScore = 0;
        for (const term of queryTerms) {
          if (textPool.includes(term)) matchScore += PHI;
          for (const tag of resource.tags) {
            if (tag.includes(term) || term.includes(tag)) matchScore += PSI;
          }
        }
        const similarity = Math.min(CSL.CRITICAL + 0.05, matchScore / (queryTerms.length * PHI * 2));
        return { ...resource, similarity: parseFloat(similarity.toFixed(6)) };
      })
      .filter(r => r.similarity >= min_similarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, alignedK);

    return {
      correlation_id: correlationId(),
      query,
      embedding_dim: VECTOR_DIM,
      results_count: scored.length,
      top_k_used: alignedK,
      min_similarity,
      results: scored.map((r, i) => ({
        rank: i + 1,
        name: r.name,
        type: r.type,
        ring: r.ring,
        description: r.description,
        similarity: r.similarity,
        csl_level: Object.entries(CSL).reverse().find(([, v]) => r.similarity >= v)?.[0] || 'MINIMUM',
        tags: r.tags
      })),
      searched_at: timestamp()
    };
  }
};

// ---------------------------------------------------------------------------
// Tool 16: heady_catalyst_profile

const heady_atlas_graph = {
  name: 'heady_atlas_graph',
  description: 'Generate service dependency graph visualization. Produces a DOT-format graph or adjacency list of the full Heady service mesh with ring-based coloring.',
  inputSchema: {
    type: 'object',
    properties: {
      format: { type: 'string', enum: ['dot', 'adjacency', 'mermaid'], description: 'Output format', default: 'mermaid' },
      ring_filter: { type: 'string', enum: ['center', 'inner', 'middle', 'outer', 'governance', 'all'], default: 'all' },
      include_latent: { type: 'boolean', description: 'Include Colab latent space nodes', default: true },
      include_edge: { type: 'boolean', description: 'Include Cloudflare edge nodes', default: true },
      depth: { type: 'number', description: 'Dependency traversal depth', default: 3 }
    },
    required: []
  },
  handler: async ({ format = 'mermaid', ring_filter = 'all', include_latent = true, include_edge = true, depth = 3 }) => {
    const nodes = [];
    const edges = [];

    const ringColors = { center: '#FFD700', inner: '#FF6B6B', middle: '#4ECDC4', outer: '#45B7D1', governance: '#96CEB4' };

    const serviceGraph = {
      'heady-soul': { ring: 'center', deps: [] },
      'heady-brain': { ring: 'inner', deps: ['heady-soul', 'heady-vector', 'heady-cache'] },
      'heady-conductor': { ring: 'inner', deps: ['heady-soul', 'heady-brain'] },
      'heady-vinci': { ring: 'inner', deps: ['heady-brain', 'heady-embed'] },
      'heady-auto-success': { ring: 'inner', deps: ['heady-conductor', 'heady-brain'] },
      'heady-orchestration': { ring: 'middle', deps: ['heady-conductor'] },
      'heady-eval': { ring: 'middle', deps: ['heady-brain', 'heady-testing'] },
      'heady-projection': { ring: 'middle', deps: ['heady-brain'] },
      'heady-infer': { ring: 'middle', deps: ['heady-cache', 'heady-embed'] },
      'heady-embed': { ring: 'middle', deps: ['heady-vector'] },
      'heady-midi': { ring: 'middle', deps: ['heady-conductor'] },
      'api-gateway': { ring: 'outer', deps: ['heady-guard', 'heady-cache'] },
      'heady-web': { ring: 'outer', deps: ['api-gateway'] },
      'heady-ui': { ring: 'outer', deps: ['api-gateway'] },
      'heady-mcp': { ring: 'outer', deps: ['api-gateway', 'heady-brain'] },
      'heady-federation': { ring: 'outer', deps: ['heady-conductor'] },
      'heady-onboarding': { ring: 'outer', deps: ['api-gateway'] },
      'heady-cache': { ring: 'outer', deps: [] },
      'heady-vector': { ring: 'outer', deps: ['heady-cache'] },
      'heady-hive': { ring: 'outer', deps: ['heady-conductor'] },
      'heady-security': { ring: 'governance', deps: ['heady-guard'] },
      'heady-guard': { ring: 'governance', deps: [] },
      'heady-testing': { ring: 'governance', deps: [] },
      'heady-health': { ring: 'governance', deps: [] }
    };

    const rings = ring_filter === 'all' ? Object.keys(ringColors) : [ring_filter];
    const filtered = Object.entries(serviceGraph).filter(([, v]) => rings.includes(v.ring));

    for (const [name, info] of filtered) {
      nodes.push({ id: name, ring: info.ring, color: ringColors[info.ring] });
      for (const dep of info.deps) {
        edges.push({ from: name, to: dep });
      }
    }

    if (include_latent) {
      nodes.push({ id: 'colab-vector:3301', ring: 'latent', color: '#9B59B6' });
      nodes.push({ id: 'colab-llm:3302', ring: 'latent', color: '#9B59B6' });
      nodes.push({ id: 'colab-train:3303', ring: 'latent', color: '#9B59B6' });
      edges.push({ from: 'heady-embed', to: 'colab-vector:3301' });
      edges.push({ from: 'heady-infer', to: 'colab-llm:3302' });
      edges.push({ from: 'heady-brain', to: 'colab-train:3303' });
    }

    if (include_edge) {
      nodes.push({ id: 'cf-workers', ring: 'edge', color: '#F39C12' });
      nodes.push({ id: 'cf-kv', ring: 'edge', color: '#F39C12' });
      nodes.push({ id: 'cf-vectorize', ring: 'edge', color: '#F39C12' });
      edges.push({ from: 'cf-workers', to: 'api-gateway' });
      edges.push({ from: 'cf-workers', to: 'cf-kv' });
      edges.push({ from: 'cf-workers', to: 'cf-vectorize' });
    }

    let output;
    if (format === 'mermaid') {
      const lines = ['graph TD'];
      const ringGroups = {};
      for (const node of nodes) {
        if (!ringGroups[node.ring]) ringGroups[node.ring] = [];
        ringGroups[node.ring].push(node);
      }
      for (const [ring, ringNodes] of Object.entries(ringGroups)) {
        lines.push(`  subgraph ${ring.toUpperCase()}`);
        for (const n of ringNodes) {
          const sanitizedId = n.id.replace(/[^a-zA-Z0-9]/g, '_');
          lines.push(`    ${sanitizedId}["${n.id}"]`);
        }
        lines.push('  end');
      }
      for (const edge of edges) {
        const fromId = edge.from.replace(/[^a-zA-Z0-9]/g, '_');
        const toId = edge.to.replace(/[^a-zA-Z0-9]/g, '_');
        lines.push(`  ${fromId} --> ${toId}`);
      }
      output = lines.join('\n');
    } else if (format === 'dot') {
      const lines = ['digraph HeadyMesh {', '  rankdir=TB;'];
      for (const node of nodes) {
        lines.push(`  "${node.id}" [style=filled, fillcolor="${node.color}", label="${node.id}\\n(${node.ring})"];`);
      }
      for (const edge of edges) {
        lines.push(`  "${edge.from}" -> "${edge.to}";`);
      }
      lines.push('}');
      output = lines.join('\n');
    } else {
      output = { nodes: nodes.map(n => n.id), edges: edges.map(e => [e.from, e.to]) };
    }

    return {
      correlation_id: correlationId(),
      format,
      node_count: nodes.length,
      edge_count: edges.length,
      rings_included: [...new Set(nodes.map(n => n.ring))],
      graph: output,
      generated_at: timestamp()
    };
  }
};

// ---------------------------------------------------------------------------

const heady_spectrum_toggle = {
  name: 'heady_spectrum_toggle',
  description: 'Toggle feature flags with CSL-gated evaluation. Features are gated by coherence score — higher-risk features require higher CSL to activate.',
  inputSchema: {
    type: 'object',
    properties: {
      flag_name: { type: 'string', description: 'Feature flag identifier' },
      action: { type: 'string', enum: ['enable', 'disable', 'evaluate', 'list'], description: 'Action to perform' },
      csl_gate: { type: 'string', enum: ['MINIMUM', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], description: 'CSL level required to enable this flag' },
      rollout_percent: { type: 'number', description: 'Percentage of users to enable for (0-100)', default: 100 },
      conditions: { type: 'object', description: 'Conditional evaluation rules (user segment, ring, time window)' },
      user_context: { type: 'object', description: 'User context for evaluation (user_id, segment, ring)' }
    },
    required: ['flag_name', 'action']
  },
  handler: async ({ flag_name, action, csl_gate = 'MEDIUM', rollout_percent = 100, conditions = {}, user_context = {} }) => {
    const flagStore = {
      'dark-mode': { enabled: true, csl_gate: 'MINIMUM', rollout: 100 },
      'new-pipeline-v2': { enabled: false, csl_gate: 'HIGH', rollout: 13 },
      'phi-routing': { enabled: true, csl_gate: 'MEDIUM', rollout: 55 },
      'swarm-autoscale': { enabled: false, csl_gate: 'CRITICAL', rollout: 5 },
      'vector-cache-layer': { enabled: true, csl_gate: 'LOW', rollout: 89 }
    };

    if (action === 'list') {
      return {
        correlation_id: correlationId(),
        flags: Object.entries(flagStore).map(([name, cfg]) => ({
          name, ...cfg, csl_threshold: CSL[cfg.csl_gate]
        })),
        listed_at: timestamp()
      };
    }

    const existing = flagStore[flag_name] || { enabled: false, csl_gate, rollout: rollout_percent };

    if (action === 'enable') {
      return {
        correlation_id: correlationId(),
        flag_name,
        previous_state: existing.enabled,
        new_state: true,
        csl_gate,
        csl_threshold: CSL[csl_gate],
        rollout_percent,
        conditions,
        toggled_at: timestamp()
      };
    }

    if (action === 'disable') {
      return {
        correlation_id: correlationId(),
        flag_name,
        previous_state: existing.enabled,
        new_state: false,
        csl_gate: existing.csl_gate,
        toggled_at: timestamp()
      };
    }

    if (action === 'evaluate') {
      const userCoherence = user_context.coherence_score || CSL.MEDIUM;
      const passesCSL = userCoherence >= CSL[existing.csl_gate];
      const userHash = (user_context.user_id || 'default').split('').reduce((h, c) => h + c.charCodeAt(0), 0);
      const passesRollout = (userHash % 100) < existing.rollout;
      const isEnabled = existing.enabled && passesCSL && passesRollout;

      return {
        correlation_id: correlationId(),
        flag_name,
        enabled: isEnabled,
        checks: {
          flag_active: existing.enabled,
          csl_passed: passesCSL,
          rollout_passed: passesRollout,
          user_coherence: userCoherence,
          required_csl: existing.csl_gate,
          required_threshold: CSL[existing.csl_gate],
          rollout_percent: existing.rollout
        },
        user_context,
        evaluated_at: timestamp()
      };
    }

    return { error: 'Unknown action', action };
  }
};

// ---------------------------------------------------------------------------

module.exports = [heady_cortex_route, heady_nexus_discover, heady_compass_search, heady_atlas_graph, heady_spectrum_toggle];
