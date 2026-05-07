const { z } = require('zod');
const { ALL_NODES } = require('../sacred-geometry');

const CapabilitySchema = z.object({
  name: z.string(),
  description: z.string(),
  limitations: z.array(z.string()).default([])
});

const AgentManifestSchema = z.object({
  id: z.string(),
  role: z.string(),
  capabilities: z.array(CapabilitySchema),
  objective: z.string()
});

const AGENT_MANIFESTS = {
  HeadySoul: {
    id: 'HeadySoul',
    role: 'Awareness and values layer — origin point',
    capabilities: [
      { name: 'Core Values Alignment', description: 'Ensures all actions align with Heady principles.', limitations: ['Does not write code', 'High abstraction level'] }
    ],
    objective: 'Maintain system integrity and philosophical alignment.'
  },
  HeadyBrains: {
    id: 'HeadyBrains',
    role: 'Processing core — orchestration, reasoning, planning',
    capabilities: [
      { name: 'Task Orchestration', description: 'Decomposes complex tasks into actionable plans.', limitations: ['Relies on external memory'] }
    ],
    objective: 'Orchestrate resources efficiently.'
  },
  HeadyVinci: {
    id: 'HeadyVinci',
    role: 'Design and architectural synthesis',
    capabilities: [
      { name: 'System Design', description: 'Generates robust system architectures.', limitations: ['Not optimized for micro-optimizations'] }
    ],
    objective: 'Synthesize optimal code topologies.'
  }
};

// Auto-fill defaults for any nodes missing explicit definitions
for (const node of ALL_NODES) {
  if (!AGENT_MANIFESTS[node]) {
    AGENT_MANIFESTS[node] = {
      id: node,
      role: 'Specialized agent node',
      capabilities: [
        { name: 'Task Execution', description: `Executes tasks assigned to ${node}.`, limitations: [] }
      ],
      objective: `Fulfill the purpose of ${node} within the latent OS.`
    };
  }
}

// Validate the manifests at boot
Object.values(AGENT_MANIFESTS).forEach(manifest => {
  AgentManifestSchema.parse(manifest);
});

module.exports = {
  AgentManifestSchema,
  AGENT_MANIFESTS
};
