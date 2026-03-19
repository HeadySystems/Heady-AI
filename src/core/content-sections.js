/**
 * © 2026 HeadySystems Inc. — Rich Content Sections for Dynamic Sites
 * 
 * Provides expanded, domain-specific content for each Heady site.
 * Each domain gets unique About, Deep Dive, Technology, and FAQ sections.
 * Zero generic content — every word is specific to the brand.
 */

const SITE_CONTENT = {
  'headyme.com': {
    about: {
      title: 'What is HeadyMe?',
      paragraphs: [
        'HeadyMe is your sovereign AI companion — a personal intelligence platform that operates across every device, every domain, and every context in your digital life. Unlike cloud-only assistants that forget you between sessions, HeadyMe maintains persistent 384-dimensional vector memory that evolves with every interaction.',
        'Built on the Sacred Geometry orchestration framework, HeadyMe routes your requests through a liquid gateway of 4+ AI providers — Claude, GPT-4o, Gemini, Groq, and Perplexity — automatically selecting the optimal model for each task. When one provider is slow or down, HeadyMe reroutes in under 50ms with zero disruption.',
        'Your data never leaves your control. HeadyMe encrypts credentials with AES-256-GCM, stores embeddings in your own pgvector instance, and runs inference at the Cloudflare edge — no round-trips to centralized servers. This is AI that works for you, not AI that works on you.',
      ],
    },
    deepDive: {
      title: 'How It Works',
      items: [
        { icon: '🔀', title: 'Liquid Gateway Routing', desc: 'Every request races through multiple AI providers simultaneously. The fastest, highest-quality response wins. Phi-weighted scoring ensures consistent output quality across Claude, GPT-4o, Gemini, Groq, and Perplexity Sonar.' },
        { icon: '🧬', title: '384D Vector Memory', desc: 'Your conversations, preferences, and knowledge are embedded in 384-dimensional vector space using Nomic Embed v2. Semantic search finds relevant context across thousands of past interactions in under 5ms via HNSW indexing.' },
        { icon: '🛡️', title: 'Zero-Trust Security', desc: 'Every API call is authenticated, every credential is encrypted at rest, and every session is time-bounded. HeadyMe implements mutual TLS, CORS whitelisting across all Heady domains, and CSP headers that block injection attacks.' },
        { icon: '🐝', title: 'Bee Swarm Execution', desc: 'Complex tasks are decomposed into subtask DAGs and distributed across specialized HeadyBee agents. Each bee has a defined lifecycle — spawn, execute, report, retire — with circuit breakers and phi-scaled backoff for fault tolerance.' },
      ],
    },
    technology: {
      title: 'Built on Battle-Tested Infrastructure',
      stack: [
        { label: 'Edge Layer', value: 'Cloudflare Workers, KV, Vectorize, Durable Objects' },
        { label: 'Compute', value: 'Google Cloud Run (us-central1), autoscaling 0→100 instances' },
        { label: 'Database', value: 'Neon Postgres + pgvector (HNSW m=21, ef_construction=89)' },
        { label: 'Auth', value: 'Firebase Auth — 25 providers, WebAuthn passkeys, SSO' },
        { label: 'AI Providers', value: 'Claude 4, GPT-4o, Gemini 2.5, Groq (Llama 4), Perplexity Sonar' },
        { label: 'Protocols', value: 'MCP (Model Context Protocol), JSON-RPC 2.0, SSE, WebSocket' },
      ],
    },
    faq: [
      { q: 'Is HeadyMe free to use?', a: 'HeadyMe offers a Spark tier with generous free usage, including 1,000 AI queries per month and 10MB of vector memory. Pro ($21/mo) and Enterprise ($89/mo) tiers unlock higher limits, priority routing, and dedicated compute.' },
      { q: 'Where is my data stored?', a: 'All data is stored in encrypted Neon Postgres instances with pgvector extensions. Embeddings are cached at the Cloudflare edge for sub-5ms retrieval. You can export or delete all your data at any time.' },
      { q: 'Which AI models does HeadyMe support?', a: 'HeadyMe routes through Claude (Anthropic), GPT-4o (OpenAI), Gemini 2.5 (Google), Groq (Llama 4), Perplexity Sonar, and Mistral. The Liquid Gateway automatically selects the best model for each task, or you can pin a specific provider.' },
      { q: 'Can I bring my own API keys?', a: 'Yes. HeadyMe supports BYOK (Bring Your Own Key) for all 13 supported AI providers. Your keys are encrypted with AES-256-GCM and never logged or transmitted to third parties.' },
    ],
  },

  'headysystems.com': {
    about: {
      title: 'What is HeadySystems?',
      paragraphs: [
        'HeadySystems is the infrastructure backbone of the Heady ecosystem — a self-healing, fault-tolerant platform built on Sacred Geometry orchestration principles. Every component in the architecture maps to a node in a phi-weighted topology that automatically detects failures, quarantines degraded services, and respawns healthy replacements without human intervention.',
        'The architecture spans 6 layers — Center (HeadySoul), Inner (Conductor, Brains), Middle (Observer, Murphy), Outer (Bridge, Sentinel), Governance (Assure, Aware), and Memory (Vector, Graph) — with 34 liquid nodes that can be dynamically reassigned based on real-time demand and coherence scoring.',
        'With 72+ provisional patents filed across Continuous Semantic Logic, Sacred Geometry Orchestration, and Alive Software self-modeling, HeadySystems represents a fundamentally new approach to distributed AI infrastructure — one where the system understands itself as deeply as it understands its users.',
      ],
    },
    deepDive: {
      title: 'Architecture Deep Dive',
      items: [
        { icon: '⚛️', title: 'Sacred Geometry Topology', desc: 'Nodes are placed according to golden-ratio-derived coordinates in a multi-layer topology. Center nodes (HeadySoul) hold the system\'s self-model. Inner nodes handle routing and reasoning. Middle nodes observe and secure. Outer nodes bridge external services.' },
        { icon: '🔄', title: 'Self-Healing Lattice', desc: 'Every service reports health via structured /health endpoints with coherence scores. When a node\'s CSL score drops below 0.809 (MEDIUM threshold), the system triggers attestation, quarantine, and respawn — all without human intervention or downtime.' },
        { icon: '📐', title: 'Continuous Semantic Logic (CSL)', desc: 'Boolean logic replaced by vector geometry. CSL AND is cosine similarity. CSL NOT is orthogonal projection. CSL GATE thresholds decisions at phi-derived cutoffs (0.500 → 0.927). This enables nuanced, continuous reasoning instead of brittle if/else chains.' },
        { icon: '🧠', title: 'Alive Software', desc: 'HeadySystems maintains a 384D embedding of its own architecture — a self-model that drifts as code changes. When semantic drift exceeds thresholds, the system alerts engineers before coherence degrades. The codebase is the genetic code; the running system is the organism.' },
      ],
    },
    technology: {
      title: 'Infrastructure at a Glance',
      stack: [
        { label: 'Services', value: '175+ microservices tracked in SERVICE_INDEX.json (v4.1.0)' },
        { label: 'Agents', value: '30+ HeadyBee types across 17 specialized swarms' },
        { label: 'Patents', value: '72+ provisional patents ($4.87M estimated portfolio value)' },
        { label: 'Repository', value: '47,904 files, monorepo architecture with Turborepo' },
        { label: 'Uptime', value: 'Multi-region Cloud Run with Cloudflare tunnel failover' },
        { label: 'Observability', value: 'Langfuse LLM tracing, Sentry errors, OpenTelemetry spans' },
      ],
    },
    faq: [
      { q: 'What makes HeadySystems different from standard microservices?', a: 'Standard microservices rely on static routing and manual scaling. HeadySystems uses CSL-weighted coherence scoring to dynamically route traffic, self-heal degraded nodes, and evolve system configuration through genetic algorithms — all governed by phi-math instead of arbitrary thresholds.' },
      { q: 'How does the patent portfolio work?', a: 'HeadySystems has filed 72+ provisional patents covering novel inventions in Continuous Semantic Logic (vector geometry as logic gates), Sacred Geometry Orchestration (phi-weighted node topology), and Alive Software (self-aware architecture). Priority patents are being converted to non-provisional filings.' },
      { q: 'Can I deploy HeadySystems infrastructure for my own projects?', a: 'HeadySystems components will be available through HeadyMCP (Model Context Protocol) and HeadyAPI. Enterprise customers can deploy dedicated instances on Cloud Run with custom Sacred Geometry topologies tailored to their workloads.' },
      { q: 'What is Continuous Semantic Logic?', a: 'CSL replaces boolean true/false with continuous vector operations. AND becomes cosine similarity, NOT becomes orthogonal projection, GATE uses phi-derived thresholds. This allows the system to make nuanced decisions on a spectrum rather than binary choices.' },
    ],
  },
};

// Generate content for all other domains from their SITES registry data
const OTHER_DOMAIN_CONTENT = {
  'headyconnection.org': {
    about: {
      title: 'What is HeadyConnection?',
      paragraphs: [
        'HeadyConnection is the nonprofit arm of the Heady ecosystem — a 501(c)(3) organization dedicated to making sovereign AI accessible to underserved communities. We believe artificial intelligence should empower everyone, not just those who can afford enterprise subscriptions.',
        'Through community programs, grant-funded research, and open educational resources, HeadyConnection bridges the gap between cutting-edge AI technology and real-world impact. Our programs span digital literacy workshops, AI-assisted job training, and community technology hubs.',
        'Every dollar donated to HeadyConnection funds direct community impact. Our operational overhead is kept below 15% through AI-automated grant management, volunteer coordination, and program tracking — the same technology we teach others to use.',
      ],
    },
    faq: [
      { q: 'Is HeadyConnection a registered nonprofit?', a: 'Yes. HeadyConnection Inc. is a registered 501(c)(3) nonprofit organization. All donations are tax-deductible to the extent allowed by law.' },
      { q: 'How can I volunteer?', a: 'We welcome volunteers for community workshops, mentoring, content creation, and technical support. Contact us at hello@headyconnection.org to get involved.' },
      { q: 'What programs does HeadyConnection run?', a: 'Our core programs include AI Literacy Workshops, Community Tech Hubs, Grant-Funded Research Projects, and the HeadyBuddy Companion Program for seniors and accessibility users.' },
    ],
  },
  'headybuddy.org': {
    about: {
      title: 'Meet HeadyBuddy',
      paragraphs: [
        'HeadyBuddy is the always-on AI companion that actually remembers you. Unlike stateless chatbots that start fresh every conversation, HeadyBuddy maintains persistent episodic, semantic, and procedural memory — learning your preferences, tracking your goals, and anticipating your needs over time.',
        'Powered by the Heady empathy core, HeadyBuddy detects emotional context through linguistic signals and adapts its response tone, pacing, and complexity accordingly. Feeling overwhelmed? HeadyBuddy simplifies. Ready for deep work? It matches your intensity.',
        'Available on web, desktop, and Android, HeadyBuddy syncs your context across every device. Start a conversation on your phone, continue it on your laptop, and pick up where you left off on any Heady-connected device.',
      ],
    },
    faq: [
      { q: 'How does HeadyBuddy remember me?', a: 'HeadyBuddy uses three memory tiers: episodic (timestamped events), semantic (extracted knowledge), and procedural (learned action rules). These are stored as 384D vector embeddings with phi-decay forgetting curves that keep relevant memories fresh.' },
      { q: 'Is HeadyBuddy available on mobile?', a: 'HeadyBuddy is available as a web app on all devices, with a native Android experience planned for Q3 2026. The HeadyBuddy widget is also embedded in every Heady domain.' },
      { q: 'Can HeadyBuddy connect to other services?', a: 'Yes. Through HeadyMCP, HeadyBuddy can connect to 30+ tools including email, calendars, project management, and code repositories. Your data stays encrypted and under your control.' },
    ],
  },
  'headymcp.com': {
    about: {
      title: 'What is HeadyMCP?',
      paragraphs: [
        'HeadyMCP is a production-grade Model Context Protocol server that exposes 30+ native tools through a single JSON-RPC 2.0 interface. Connect any MCP-compatible IDE — VS Code, Cursor, Windsurf, or Zed — and get instant access to the entire Heady intelligence layer.',
        'Every tool is CSL-gated with semantic rate limiting, zero-trust sandboxed execution, and cryptographic audit logging. Whether you\'re querying vector memory, generating code, or deploying services, every action is authenticated, validated, and traceable.',
        'HeadyMCP supports three transport modes: stdio for local agents, Server-Sent Events (SSE) for remote streaming, and WebSocket for bidirectional real-time connections. Multi-transport means your IDE talks to Heady in whatever protocol it speaks.',
      ],
    },
    faq: [
      { q: 'Which IDEs support HeadyMCP?', a: 'Any IDE that implements the Model Context Protocol can connect to HeadyMCP. This includes VS Code (via Copilot or Continue), Cursor, Windsurf, Zed, and any custom MCP client. Configuration takes under 2 minutes.' },
      { q: 'What tools are available?', a: 'HeadyMCP exposes 30+ tools including chat (multi-model), code generation, vector memory search, embedding creation, deployment, health checks, governance, and more. Each tool has a full JSON Schema definition for auto-discovery.' },
      { q: 'Is HeadyMCP free?', a: 'HeadyMCP is free for open-source contributors and HeadyConnection community members. Commercial use requires a HeadyIO API key with per-request pricing starting at $0.001 per tool invocation.' },
    ],
  },
};

/**
 * Get content sections for a given domain.
 * Returns the rich content if available, otherwise generates minimal placeholders
 * from the site registry data.
 */
function getContentForDomain(domain) {
  return SITE_CONTENT[domain] || OTHER_DOMAIN_CONTENT[domain] || null;
}

module.exports = { SITE_CONTENT, OTHER_DOMAIN_CONTENT, getContentForDomain };
