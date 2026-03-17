// packages/heady-conductor/src/a2a-cards.js
// A2A Protocol — Agent Cards for all 17 Heady swarms
// Each swarm publishes an Agent Card advertising capabilities over HTTP/SSE
import { HEADY_DOMAINS } from '../../heady-core/src/phi.js';

const API_BASE = process.env.CLOUD_RUN_URL || 'https://api.headysystems.com';

/**
 * A2A Agent Card schema.
 * @typedef {{ name: string, description: string, url: string, capabilities: string[], inputSchema: object, outputSchema: object }} AgentCard
 */

/**
 * All 17 Heady swarm Agent Cards.
 * @returns {AgentCard[]}
 */
export function getAgentCards() {
  return [
    {
      name: 'HeadySystems',
      description: 'Platform orchestrator — routes tasks, monitors health, manages deployments across all 11 domains',
      url: `${API_BASE}/a2a/systems`,
      capabilities: ['orchestration', 'health-monitoring', 'deployment', 'routing'],
      provider: { organization: 'HeadySystems Inc.' }
    },
    {
      name: 'HeadyBrain',
      description: 'Core intelligence — runs HCFullPipeline 22-stage cognitive processing, memory bootstrap, CSL scoring',
      url: `${API_BASE}/a2a/brain`,
      capabilities: ['reasoning', 'memory-retrieval', 'csl-scoring', 'pipeline-execution'],
      provider: { organization: 'HeadySystems Inc.' }
    },
    {
      name: 'HeadyBuddy',
      description: 'AI companion — emotional intelligence, conversational support, personality adaptation',
      url: `${API_BASE}/a2a/buddy`,
      capabilities: ['conversation', 'emotional-intelligence', 'support', 'personality-matching'],
      provider: { organization: 'HeadySystems Inc.' }
    },
    {
      name: 'HeadyBattle',
      description: 'Arena orchestrator — parallel AI node competition, A/B testing, performance benchmarking',
      url: `${API_BASE}/a2a/battle`,
      capabilities: ['benchmarking', 'ab-testing', 'arena-competition', 'scoring'],
      provider: { organization: 'HeadySystems Inc.' }
    },
    {
      name: 'HeadyMC',
      description: 'Monte Carlo simulation — probabilistic reasoning, scenario modeling, risk analysis',
      url: `${API_BASE}/a2a/mc`,
      capabilities: ['simulation', 'monte-carlo', 'risk-analysis', 'probabilistic-reasoning'],
      provider: { organization: 'HeadySystems Inc.' }
    },
    {
      name: 'HeadyDecomp',
      description: 'Task decomposition — breaks complex tasks into parallel subtasks for swarm execution',
      url: `${API_BASE}/a2a/decomp`,
      capabilities: ['task-decomposition', 'dag-building', 'dependency-analysis'],
      provider: { organization: 'HeadySystems Inc.' }
    },
    {
      name: 'HeadyCreative',
      description: 'Creative intelligence — image generation, music composition, content creation, MIDI',
      url: `${API_BASE}/a2a/creative`,
      capabilities: ['image-generation', 'music-composition', 'content-creation', 'midi'],
      provider: { organization: 'HeadySystems Inc.' }
    },
    {
      name: 'HeadyFinance',
      description: 'Financial intelligence — market analysis, portfolio optimization, trading signals, HeadyCoin',
      url: `${API_BASE}/a2a/finance`,
      capabilities: ['market-analysis', 'portfolio-optimization', 'trading', 'crypto'],
      provider: { organization: 'HeadySystems Inc.' }
    },
    {
      name: 'HeadySims',
      description: 'Simulation engine — multi-agent environments, scenario testing, world modeling',
      url: `${API_BASE}/a2a/sims`,
      capabilities: ['simulation', 'world-modeling', 'scenario-testing'],
      provider: { organization: 'HeadySystems Inc.' }
    },
    {
      name: 'HeadyLens',
      description: 'Vision intelligence — image analysis, OCR, visual search, spatial computing',
      url: `${API_BASE}/a2a/lens`,
      capabilities: ['image-analysis', 'ocr', 'visual-search', 'spatial-computing'],
      provider: { organization: 'HeadySystems Inc.' }
    },
    {
      name: 'HeadyConductor',
      description: 'LangGraph DAG orchestrator — manages complex multi-step workflows with dependency resolution',
      url: `${API_BASE}/a2a/conductor`,
      capabilities: ['dag-orchestration', 'workflow-management', 'step-sequencing'],
      provider: { organization: 'HeadySystems Inc.' }
    },
    {
      name: 'HeadyBee',
      description: 'CrewAI swarm spawner — spawns and coordinates up to 34 worker bees for parallel execution',
      url: `${API_BASE}/a2a/bee`,
      capabilities: ['swarm-spawning', 'parallel-execution', 'worker-coordination'],
      provider: { organization: 'HeadySystems Inc.' }
    },
    {
      name: 'HeadyGuard',
      description: 'Security fortress — Zod validation, PQC encryption, Ed25519 signing, injection detection, WAF',
      url: `${API_BASE}/a2a/guard`,
      capabilities: ['security', 'validation', 'encryption', 'signing', 'pii-detection'],
      provider: { organization: 'HeadySystems Inc.' }
    },
    {
      name: 'HeadyDistiller',
      description: 'Knowledge compression — Stage 22 distillation, pattern extraction, memory consolidation',
      url: `${API_BASE}/a2a/distiller`,
      capabilities: ['knowledge-compression', 'pattern-extraction', 'memory-consolidation'],
      provider: { organization: 'HeadySystems Inc.' }
    },
    {
      name: 'HeadyEval',
      description: 'Quality assurance — LLM-as-judge evaluation, anti-regression testing, quality gates',
      url: `${API_BASE}/a2a/eval`,
      capabilities: ['evaluation', 'quality-gating', 'anti-regression', 'benchmarking'],
      provider: { organization: 'HeadySystems Inc.' }
    },
    {
      name: 'HeadyMCP',
      description: 'MCP server hub — exposes Heady tools via Model Context Protocol for external AI agents',
      url: `${API_BASE}/a2a/mcp`,
      capabilities: ['mcp-server', 'tool-discovery', 'external-integration'],
      provider: { organization: 'HeadySystems Inc.' }
    },
    {
      name: 'HeadyBot',
      description: 'Discord bot — community engagement, slash commands, real-time notifications',
      url: `${API_BASE}/a2a/bot`,
      capabilities: ['discord', 'slash-commands', 'notifications', 'community'],
      provider: { organization: 'HeadySystems Inc.' }
    }
  ];
}

/**
 * Serve the well-known A2A Agent Card endpoint.
 * Mount at: GET /.well-known/agent.json
 */
export function agentCardHandler(req, res) {
  const cards = getAgentCards();
  res.json({
    version: '0.3',
    name: 'HeadyAI Agent Network',
    description: '17 specialized AI agents forming the Heady intelligence mesh',
    url: API_BASE,
    agents: cards,
    authentication: { type: 'bearer', scheme: 'firebase-session-cookie' },
    defaultInputContentTypes: ['application/json'],
    defaultOutputContentTypes: ['application/json', 'text/event-stream']
  });
}
