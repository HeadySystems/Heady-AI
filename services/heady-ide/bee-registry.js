// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Bee Registry v5.0 — 144 Bee Types × 21 Swarms          ║
// ║  Complete typed registry for BeeFactory instantiation            ║
// ║  ⚠️ PATENT LOCK — HS-2026-051, HS-2026-054                     ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder               ║
// ╚══════════════════════════════════════════════════════════════════╝

const PHI = (1 + Math.sqrt(5)) / 2;
const PSI = 1 / PHI;
const FIB = [0,1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987,1597,2584,4181,6765];

// ── Swarm Definitions ───────────────────────────────────────────────
export const SWARMS = [
  { id: 'overmind',    name: 'Overmind',    domain: 'Decision & Orchestration',       color: '#00d4aa', geometry: 'dodecahedron' },
  { id: 'governance',  name: 'Governance',  domain: 'Policy, Compliance, Audit',      color: '#7c5eff', geometry: 'cube' },
  { id: 'forge',       name: 'Forge',       domain: 'Code Generation & Mutation',     color: '#ff6b35', geometry: 'octahedron' },
  { id: 'emissary',    name: 'Emissary',    domain: 'Documentation & Protocol',       color: '#00b4d8', geometry: 'icosahedron' },
  { id: 'foundry',     name: 'Foundry',     domain: 'Training & Fine-tuning',         color: '#e63946', geometry: 'tetrahedron' },
  { id: 'studio',      name: 'Studio',      domain: 'Music, Audio, Creative',         color: '#f72585', geometry: 'torus' },
  { id: 'arbiter',     name: 'Arbiter',     domain: 'IP Protection & Legal',          color: '#b5838d', geometry: 'cube' },
  { id: 'diplomat',    name: 'Diplomat',     domain: 'B2B & Partnerships',             color: '#6d6875', geometry: 'sphere' },
  { id: 'oracle',      name: 'Oracle',      domain: 'Economics & Cost',               color: '#ffd166', geometry: 'pyramid' },
  { id: 'quant',       name: 'Quant',       domain: 'Trading & Risk',                 color: '#06d6a0', geometry: 'octahedron' },
  { id: 'fabricator',  name: 'Fabricator',  domain: 'IoT & Physical',                 color: '#118ab2', geometry: 'tetrahedron' },
  { id: 'persona',     name: 'Persona',     domain: 'Personality & Empathy',          color: '#ef476f', geometry: 'sphere' },
  { id: 'sentinel',    name: 'Sentinel',    domain: 'Security & Self-Healing',        color: '#e63946', geometry: 'icosahedron' },
  { id: 'nexus',       name: 'Nexus',       domain: 'Blockchain & Contracts',         color: '#a8dadc', geometry: 'dodecahedron' },
  { id: 'dreamer',     name: 'Dreamer',     domain: 'Simulation & Creativity',        color: '#9b5de5', geometry: 'torus' },
  { id: 'tensor',      name: 'Tensor',      domain: 'CSL Logic & Vector Ops',         color: '#00f5d4', geometry: 'tesseract' },
  { id: 'topology',    name: 'Topology',    domain: 'Dependencies & Graphs',          color: '#fee440', geometry: 'hypercube' },
  { id: 'librarian',   name: 'Librarian',   domain: 'Memory & RAG',                   color: '#cdb4db', geometry: 'flower_of_life' },
  { id: 'healer',      name: 'Healer',      domain: 'Health & Wellness',              color: '#52b788', geometry: 'seed_of_life' },
  { id: 'navigator',   name: 'Navigator',   domain: 'Planning & Scheduling',          color: '#4cc9f0', geometry: 'compass_rose' },
  { id: 'alchemist',   name: 'Alchemist',   domain: 'Evolution & Self-Improvement',   color: '#f9c74f', geometry: 'metatrons_cube' },
];

// ── 144 Bee Type Definitions ────────────────────────────────────────
export const BEE_TYPES = [
  // ─── OVERMIND (1-10) ──────────────────────────────────────────
  { id: 1,   type: 'OrchestratorBee',          swarm: 'overmind',   cslGate: 0.0,   desc: 'Master task decomposition and DAG construction' },
  { id: 2,   type: 'OvermindDirectorBee',      swarm: 'overmind',   cslGate: 0.718, desc: 'Strategic multi-swarm coordination' },
  { id: 3,   type: 'PriorityResolverBee',      swarm: 'overmind',   cslGate: 0.618, desc: 'CSL-scored resource contention resolution' },
  { id: 4,   type: 'PipelineControllerBee',    swarm: 'overmind',   cslGate: 0.0,   desc: 'HCFullPipeline stage transitions and checkpoints' },
  { id: 5,   type: 'LoadBalancerBee',          swarm: 'overmind',   cslGate: 0.382, desc: 'φ-weighted work distribution across bee pool' },
  { id: 6,   type: 'EscalationBee',            swarm: 'overmind',   cslGate: 0.618, desc: 'Stalled task detection and provider escalation' },
  { id: 7,   type: 'MergeBee',                 swarm: 'overmind',   cslGate: 0.618, desc: 'Parallel branch output combination at sync points' },
  { id: 8,   type: 'PreemptionBee',            swarm: 'overmind',   cslGate: 0.0,   desc: 'Interrupts background tasks for user requests' },
  { id: 9,   type: 'CanaryBee',                swarm: 'overmind',   cslGate: 0.718, desc: 'φ-stepped canary deployment management' },
  { id: 10,  type: 'HeartbeatBee',             swarm: 'overmind',   cslGate: 0.0,   desc: 'φ⁷ms health pulses and swarm failure detection' },

  // ─── GOVERNANCE (11-18) ───────────────────────────────────────
  { id: 11,  type: 'AuditBee',                 swarm: 'governance', cslGate: 0.0,   desc: 'Immutable audit log for state-mutating operations' },
  { id: 12,  type: 'ComplianceBee',            swarm: 'governance', cslGate: 0.618, desc: 'Policy ruleset validation pre-execution' },
  { id: 13,  type: 'PermissionGuardBee',       swarm: 'governance', cslGate: 0.0,   desc: 'RBAC enforcement with Firebase JWT' },
  { id: 14,  type: 'SecretRotatorBee',         swarm: 'governance', cslGate: 0.718, desc: 'φ-scheduled API key and certificate rotation' },
  { id: 15,  type: 'DataResidencyBee',         swarm: 'governance', cslGate: 0.718, desc: 'Jurisdictional data boundary enforcement' },
  { id: 16,  type: 'ConsentTrackerBee',        swarm: 'governance', cslGate: 0.618, desc: 'Cross-domain consent state management' },
  { id: 17,  type: 'RetentionPolicyBee',       swarm: 'governance', cslGate: 0.618, desc: 'Data retention schedule enforcement and purge' },
  { id: 18,  type: 'GlassBoxBee',              swarm: 'governance', cslGate: 0.718, desc: 'Human-readable AI decision explanations' },

  // ─── FORGE (19-27) ────────────────────────────────────────────
  { id: 19,  type: 'ASTMutatorBee',            swarm: 'forge',      cslGate: 0.618, desc: 'Abstract syntax tree code transformation' },
  { id: 20,  type: 'HologramBee',              swarm: 'forge',      cslGate: 0.618, desc: 'Complete file projection from specifications' },
  { id: 21,  type: 'ChaosTesterBee',           swarm: 'forge',      cslGate: 0.718, desc: 'Fault injection for error handling verification' },
  { id: 22,  type: 'ContextWeaverBee',         swarm: 'forge',      cslGate: 0.618, desc: 'Multi-file context assembly for code generation' },
  { id: 23,  type: 'LintEnforcerBee',          swarm: 'forge',      cslGate: 0.0,   desc: 'ESLint + φ-complexity enforcement' },
  { id: 24,  type: 'TestForgerBee',            swarm: 'forge',      cslGate: 0.618, desc: 'Vitest unit test generation with edge cases' },
  { id: 25,  type: 'DependencyBee',            swarm: 'forge',      cslGate: 0.382, desc: 'Circular dependency and module boundary analysis' },
  { id: 26,  type: 'MigrationBee',             swarm: 'forge',      cslGate: 0.718, desc: 'Database migration SQL with rollback scripts' },
  { id: 27,  type: 'DeadCodeReaperBee',        swarm: 'forge',      cslGate: 0.382, desc: 'Unreachable code and unused export removal' },

  // ─── EMISSARY (28-34) ─────────────────────────────────────────
  { id: 28,  type: 'DocumentationBee',         swarm: 'emissary',   cslGate: 0.618, desc: 'Auto-generated docs from code signatures' },
  { id: 29,  type: 'MCPProtocolBee',           swarm: 'emissary',   cslGate: 0.0,   desc: 'MCP server lifecycle and tool registration' },
  { id: 30,  type: 'SDKPublisherBee',          swarm: 'emissary',   cslGate: 0.718, desc: 'Package versioning and npm/PyPI publishing' },
  { id: 31,  type: 'A2ABridgeBee',             swarm: 'emissary',   cslGate: 0.618, desc: 'MCP ↔ A2A agent protocol translation' },
  { id: 32,  type: 'AGUIRendererBee',          swarm: 'emissary',   cslGate: 0.382, desc: 'Agent output → AG-UI interactive events' },
  { id: 33,  type: 'ChangelogBee',             swarm: 'emissary',   cslGate: 0.618, desc: 'Conventional commit → structured changelog' },
  { id: 34,  type: 'OnboardingGuideBee',       swarm: 'emissary',   cslGate: 0.382, desc: 'Personalized onboarding sequence creation' },

  // ─── FOUNDRY (35-41) ──────────────────────────────────────────
  { id: 35,  type: 'DataCuratorBee',           swarm: 'foundry',    cslGate: 0.618, desc: 'Training data collection and deduplication' },
  { id: 36,  type: 'TrainingOrchestratorBee',  swarm: 'foundry',    cslGate: 0.718, desc: 'QLoRA fine-tuning across Colab runtimes' },
  { id: 37,  type: 'EvalBenchmarkBee',         swarm: 'foundry',    cslGate: 0.618, desc: 'Standardized model benchmarking' },
  { id: 38,  type: 'DatasetVersionBee',        swarm: 'foundry',    cslGate: 0.382, desc: 'Dataset lineage and version tracking' },
  { id: 39,  type: 'SyntheticDataBee',         swarm: 'foundry',    cslGate: 0.618, desc: 'LLM-augmented synthetic data generation' },
  { id: 40,  type: 'DistillationBee',          swarm: 'foundry',    cslGate: 0.618, desc: 'Knowledge compression into compact representations' },
  { id: 41,  type: 'PromptOptBee',             swarm: 'foundry',    cslGate: 0.718, desc: 'DSPy-style prompt optimization and A/B testing' },

  // ─── STUDIO (42-48) ───────────────────────────────────────────
  { id: 42,  type: 'CloudMIDIBee',             swarm: 'studio',     cslGate: 0.618, desc: 'MIDI sequence generation from text' },
  { id: 43,  type: 'DAWBridgeBee',             swarm: 'studio',     cslGate: 0.382, desc: 'Ableton Live OSC session management' },
  { id: 44,  type: 'SysExReceiverBee',         swarm: 'studio',     cslGate: 0.382, desc: 'Hardware synth SysEx parameter exchange' },
  { id: 45,  type: 'AudioAnalyzerBee',         swarm: 'studio',     cslGate: 0.618, desc: 'Tempo, key, spectral feature extraction' },
  { id: 46,  type: 'StemSplitterBee',          swarm: 'studio',     cslGate: 0.618, desc: 'Audio source separation via Demucs' },
  { id: 47,  type: 'PhiHarmonicsBee',          swarm: 'studio',     cslGate: 0.618, desc: 'Fibonacci-interval melody and φ-timing composition' },
  { id: 48,  type: 'MasteringBee',             swarm: 'studio',     cslGate: 0.718, desc: 'Loudness, EQ, limiting for distribution-ready audio' },

  // ─── ARBITER (49-54) ──────────────────────────────────────────
  { id: 49,  type: 'PatentHarvestBee',         swarm: 'arbiter',    cslGate: 0.718, desc: 'Novel method detection and provisional filing' },
  { id: 50,  type: 'LicenseComplianceBee',     swarm: 'arbiter',    cslGate: 0.618, desc: 'Dependency license conflict scanning' },
  { id: 51,  type: 'IPProtectionBee',          swarm: 'arbiter',    cslGate: 0.718, desc: 'External IP infringement monitoring' },
  { id: 52,  type: 'PriorArtSearchBee',        swarm: 'arbiter',    cslGate: 0.618, desc: 'USPTO/EPO/WIPO prior art search' },
  { id: 53,  type: 'ClaimDrafterBee',          swarm: 'arbiter',    cslGate: 0.718, desc: 'Patent claim language generation' },
  { id: 54,  type: 'ContractReviewBee',        swarm: 'arbiter',    cslGate: 0.618, desc: 'Vendor contract risk clause analysis' },

  // ─── DIPLOMAT (55-59) ─────────────────────────────────────────
  { id: 55,  type: 'ProcurementBee',           swarm: 'diplomat',   cslGate: 0.618, desc: 'SaaS vendor cost/capability evaluation' },
  { id: 56,  type: 'RateLimitNegotiatorBee',   swarm: 'diplomat',   cslGate: 0.382, desc: 'Rate limit detection and backoff negotiation' },
  { id: 57,  type: 'PartnerScoutBee',          swarm: 'diplomat',   cslGate: 0.618, desc: 'API ecosystem integration partner discovery' },
  { id: 58,  type: 'VendorHealthBee',          swarm: 'diplomat',   cslGate: 0.382, desc: 'Vendor uptime, pricing, and sunset monitoring' },
  { id: 59,  type: 'ProposalBee',              swarm: 'diplomat',   cslGate: 0.718, desc: 'Partnership proposal drafting with value analysis' },

  // ─── ORACLE (60-66) ───────────────────────────────────────────
  { id: 60,  type: 'CostTrackerBee',           swarm: 'oracle',     cslGate: 0.0,   desc: 'Real-time cloud spend aggregation' },
  { id: 61,  type: 'BudgetGuardianBee',        swarm: 'oracle',     cslGate: 0.718, desc: 'Monthly cap enforcement and auto-downgrade' },
  { id: 62,  type: 'ForecastBee',              swarm: 'oracle',     cslGate: 0.618, desc: '30/60/90-day cost projection via φ-weighted MA' },
  { id: 63,  type: 'BillingReconcileBee',      swarm: 'oracle',     cslGate: 0.618, desc: 'Invoice vs usage cross-check' },
  { id: 64,  type: 'TokenCounterBee',          swarm: 'oracle',     cslGate: 0.0,   desc: 'LLM token usage tracking by model/task' },
  { id: 65,  type: 'DowngradeBee',             swarm: 'oracle',     cslGate: 0.718, desc: 'Automatic model tier downgrade under pressure' },
  { id: 66,  type: 'RevenueTrackerBee',        swarm: 'oracle',     cslGate: 0.618, desc: 'Subscription MRR/ARR and churn tracking' },

  // ─── QUANT (67-74) ────────────────────────────────────────────
  { id: 67,  type: 'MarketAnalyzerBee',        swarm: 'quant',      cslGate: 0.618, desc: 'Technical indicators and pattern recognition' },
  { id: 68,  type: 'RiskManagerBee',           swarm: 'quant',      cslGate: 0.718, desc: 'Kelly criterion position sizing with φ-caps' },
  { id: 69,  type: 'BacktestBee',              swarm: 'quant',      cslGate: 0.618, desc: 'Walk-forward historical strategy simulation' },
  { id: 70,  type: 'SignalGeneratorBee',       swarm: 'quant',      cslGate: 0.718, desc: 'Multi-indicator buy/sell/hold signal fusion' },
  { id: 71,  type: 'OrderExecutorBee',         swarm: 'quant',      cslGate: 0.718, desc: 'Broker API order execution with slippage control' },
  { id: 72,  type: 'FibRetraceBee',            swarm: 'quant',      cslGate: 0.618, desc: 'Fibonacci retracement/extension price targets' },
  { id: 73,  type: 'SentimentBee',             swarm: 'quant',      cslGate: 0.382, desc: 'Financial news and social sentiment scoring' },
  { id: 74,  type: 'PortfolioRebalanceBee',    swarm: 'quant',      cslGate: 0.618, desc: 'φ-weighted drift band rebalancing' },

  // ─── FABRICATOR (75-81) ───────────────────────────────────────
  { id: 75,  type: 'IoTEnvironmentBee',        swarm: 'fabricator', cslGate: 0.382, desc: 'MQTT/HTTP sensor aggregation into state model' },
  { id: 76,  type: 'CADMutatorBee',            swarm: 'fabricator', cslGate: 0.618, desc: '3D geometry generation from text (STL/STEP)' },
  { id: 77,  type: 'PrinterBee',               swarm: 'fabricator', cslGate: 0.618, desc: 'OctoPrint/Klipper control and G-code generation' },
  { id: 78,  type: 'OBDDiagnosticsBee',        swarm: 'fabricator', cslGate: 0.382, desc: 'Vehicle diagnostic code reading and prediction' },
  { id: 79,  type: 'EnergyManagerBee',         swarm: 'fabricator', cslGate: 0.618, desc: 'Solar/battery/EV/grid optimization' },
  { id: 80,  type: 'FirmwareBee',              swarm: 'fabricator', cslGate: 0.718, desc: 'ESP32/Arduino firmware generation and flashing' },
  { id: 81,  type: 'DigitalTwinBee',           swarm: 'fabricator', cslGate: 0.618, desc: 'Live virtual replica of physical systems' },

  // ─── PERSONA (82-88) ──────────────────────────────────────────
  { id: 82,  type: 'BioSyncBee',               swarm: 'persona',    cslGate: 0.382, desc: 'Wearable biometric → response tone calibration' },
  { id: 83,  type: 'PersonaPersistenceBee',     swarm: 'persona',    cslGate: 0.618, desc: 'Cross-session personality vector maintenance' },
  { id: 84,  type: 'EmotionDetectorBee',       swarm: 'persona',    cslGate: 0.382, desc: 'User sentiment and emotional state analysis' },
  { id: 85,  type: 'ToneAdaptorBee',           swarm: 'persona',    cslGate: 0.618, desc: 'Response formality/warmth/humor adjustment' },
  { id: 86,  type: 'CulturalContextBee',       swarm: 'persona',    cslGate: 0.382, desc: 'Locale-aware communication adaptation' },
  { id: 87,  type: 'AccessibilityBee',         swarm: 'persona',    cslGate: 0.618, desc: 'WCAG compliance and screen reader optimization' },
  { id: 88,  type: 'EvolutionBee',             swarm: 'persona',    cslGate: 0.718, desc: 'φ-constrained personality development over time' },

  // ─── SENTINEL (89-97) ─────────────────────────────────────────
  { id: 89,  type: 'ThreatDetectorBee',        swarm: 'sentinel',   cslGate: 0.0,   desc: 'Real-time API endpoint anomaly detection' },
  { id: 90,  type: 'VulnScannerBee',           swarm: 'sentinel',   cslGate: 0.618, desc: 'npm audit + Snyk dependency vulnerability scan' },
  { id: 91,  type: 'IncidentResponderBee',     swarm: 'sentinel',   cslGate: 0.718, desc: 'Automated incident triage and severity assignment' },
  { id: 92,  type: 'PromptInjectionGuardBee',  swarm: 'sentinel',   cslGate: 0.0,   desc: 'Prompt injection attack detection and neutralization' },
  { id: 93,  type: 'RateLimitShieldBee',       swarm: 'sentinel',   cslGate: 0.382, desc: 'Per-tenant token bucket rate limiting' },
  { id: 94,  type: 'CertWatcherBee',           swarm: 'sentinel',   cslGate: 0.618, desc: 'TLS certificate expiry monitoring and renewal' },
  { id: 95,  type: 'IntrusionForensicsBee',    swarm: 'sentinel',   cslGate: 0.718, desc: 'Post-breach attack timeline reconstruction' },
  { id: 96,  type: 'SelfHealBee',              swarm: 'sentinel',   cslGate: 0.718, desc: 'Service restart, conn flush, credential rotation' },
  { id: 97,  type: 'WAFTunerBee',              swarm: 'sentinel',   cslGate: 0.618, desc: 'Cloudflare WAF rule adaptation from patterns' },

  // ─── NEXUS (98-102) ───────────────────────────────────────────
  { id: 98,  type: 'ContractDeployBee',        swarm: 'nexus',      cslGate: 0.718, desc: 'Smart contract compilation and deployment' },
  { id: 99,  type: 'ChainMonitorBee',          swarm: 'nexus',      cslGate: 0.382, desc: 'On-chain event and transaction monitoring' },
  { id: 100, type: 'WalletManagerBee',         swarm: 'nexus',      cslGate: 0.718, desc: 'HD wallet derivation and transaction signing' },
  { id: 101, type: 'TokenMinterBee',           swarm: 'nexus',      cslGate: 0.718, desc: 'ERC-20/721 token creation with rules' },
  { id: 102, type: 'GasOptimizerBee',          swarm: 'nexus',      cslGate: 0.618, desc: 'Gas price prediction and tx batching' },

  // ─── DREAMER (103-109) ────────────────────────────────────────
  { id: 103, type: 'MonteCarloSimBee',         swarm: 'dreamer',    cslGate: 0.618, desc: '1K+ scenario risk simulation' },
  { id: 104, type: 'WhatIfBee',                swarm: 'dreamer',    cslGate: 0.382, desc: 'Alternate outcome exploration' },
  { id: 105, type: 'ScenarioGeneratorBee',     swarm: 'dreamer',    cslGate: 0.618, desc: 'Plausible future scenario construction' },
  { id: 106, type: 'CreativeSparkBee',         swarm: 'dreamer',    cslGate: 0.382, desc: 'Lateral thinking and unusual connections' },
  { id: 107, type: 'DreamStateBee',            swarm: 'dreamer',    cslGate: 0.618, desc: 'Offline idle-period pattern synthesis' },
  { id: 108, type: 'CounterfactualBee',        swarm: 'dreamer',    cslGate: 0.618, desc: 'Past decision alternate outcome analysis' },
  { id: 109, type: 'StressTestBee',            swarm: 'dreamer',    cslGate: 0.718, desc: 'Extreme condition simulation (10× load)' },

  // ─── TENSOR (110-116) ─────────────────────────────────────────
  { id: 110, type: 'ResonanceBee',             swarm: 'tensor',     cslGate: 0.0,   desc: 'CSL IF — cosine similarity evaluation' },
  { id: 111, type: 'SuperpositionBee',         swarm: 'tensor',     cslGate: 0.382, desc: 'CSL AND — vector concept combination' },
  { id: 112, type: 'OrthogonalBee',            swarm: 'tensor',     cslGate: 0.382, desc: 'CSL NOT — orthogonal projection negation' },
  { id: 113, type: 'ConsensusBee',             swarm: 'tensor',     cslGate: 0.618, desc: 'Multi-agent weighted agreement scoring' },
  { id: 114, type: 'AnalogyBee',               swarm: 'tensor',     cslGate: 0.618, desc: 'CSL ANALOGY — semantic arithmetic' },
  { id: 115, type: 'EmbeddingBee',             swarm: 'tensor',     cslGate: 0.0,   desc: '384D/1536D embedding generation' },
  { id: 116, type: 'SacredGeometryBee',        swarm: 'tensor',     cslGate: 0.618, desc: 'φ-form, Fibonacci spiral, Platonic solid computation' },

  // ─── TOPOLOGY (117-122) ───────────────────────────────────────
  { id: 117, type: 'ManifoldBee',              swarm: 'topology',   cslGate: 0.618, desc: 'PCA/t-SNE/UMAP dimensionality reduction' },
  { id: 118, type: 'EntanglementBee',          swarm: 'topology',   cslGate: 0.382, desc: 'Inter-service/repo dependency tracking' },
  { id: 119, type: 'ClusterBee',               swarm: 'topology',   cslGate: 0.618, desc: 'K-means/DBSCAN clustering with φ-scaled k' },
  { id: 120, type: 'GraphBuildBee',            swarm: 'topology',   cslGate: 0.618, desc: 'Knowledge graph construction from entities' },
  { id: 121, type: 'PathfinderBee',            swarm: 'topology',   cslGate: 0.382, desc: 'Optimal path through dependency graphs' },
  { id: 122, type: 'AnomalyBee',               swarm: 'topology',   cslGate: 0.618, desc: 'Graph structural anomaly detection' },

  // ─── LIBRARIAN (123-130) — NEW ────────────────────────────────
  { id: 123, type: 'MemoryWriteBee',           swarm: 'librarian',  cslGate: 0.382, desc: 'CSL-importance-scored memory upsert to correct tier' },
  { id: 124, type: 'MemoryRecallBee',          swarm: 'librarian',  cslGate: 0.382, desc: 'Cross-tier unified search (Redis→pgvector→Qdrant)' },
  { id: 125, type: 'ConsolidationBee',         swarm: 'librarian',  cslGate: 0.618, desc: 'Inter-tier memory migration based on access/decay' },
  { id: 126, type: 'ForgettingBee',            swarm: 'librarian',  cslGate: 0.618, desc: 'φ-curve principled memory decay' },
  { id: 127, type: 'ContextWindowBee',         swarm: 'librarian',  cslGate: 0.618, desc: 'CSL-ranked context packing into LLM token budget' },
  { id: 128, type: 'RerankBee',                swarm: 'librarian',  cslGate: 0.618, desc: 'Jina Reranker precision re-scoring' },
  { id: 129, type: 'IndexRefreshBee',          swarm: 'librarian',  cslGate: 0.382, desc: 'HNSW/BM25 index rebuild and vacuum' },
  { id: 130, type: 'CrossSessionBee',          swarm: 'librarian',  cslGate: 0.718, desc: 'Consciousness snapshot for session continuity' },

  // ─── HEALER (131-137) — NEW ───────────────────────────────────
  { id: 131, type: 'WearableFusionBee',        swarm: 'healer',     cslGate: 0.382, desc: 'Multi-wearable data fusion into health model' },
  { id: 132, type: 'SleepArchitectBee',        swarm: 'healer',     cslGate: 0.618, desc: 'Sleep stage analysis and bedtime optimization' },
  { id: 133, type: 'NutritionBee',             swarm: 'healer',     cslGate: 0.618, desc: 'Macro/micro tracking with glucose correlation' },
  { id: 134, type: 'MovementBee',              swarm: 'healer',     cslGate: 0.618, desc: 'Progressive overload workout programming' },
  { id: 135, type: 'SymptomCorrelatorBee',     swarm: 'healer',     cslGate: 0.618, desc: 'Symptom × environment × behavior pattern mining' },
  { id: 136, type: 'CircadianBee',             swarm: 'healer',     cslGate: 0.382, desc: 'Chronotype modeling and peak performance prediction' },
  { id: 137, type: 'MeditationGuideBee',       swarm: 'healer',     cslGate: 0.382, desc: 'Biometric-responsive φ-timed meditation guidance' },

  // ─── NAVIGATOR (138-143) — NEW ────────────────────────────────
  { id: 138, type: 'SchedulerBee',             swarm: 'navigator',  cslGate: 0.382, desc: 'Natural language → cron with φ-intervals' },
  { id: 139, type: 'GoalTrackerBee',           swarm: 'navigator',  cslGate: 0.618, desc: 'Multi-step goal progress and milestone alerts' },
  { id: 140, type: 'RoutePlannerBee',          swarm: 'navigator',  cslGate: 0.618, desc: 'Multi-stop route optimization' },
  { id: 141, type: 'DeadlineWatcherBee',       swarm: 'navigator',  cslGate: 0.618, desc: 'φ-interval escalating deadline reminders' },
  { id: 142, type: 'CalendarBee',              swarm: 'navigator',  cslGate: 0.382, desc: 'Cross-timezone meeting scheduling' },
  { id: 143, type: 'TimeBoxBee',               swarm: 'navigator',  cslGate: 0.382, desc: 'φ-proportioned deep work/break time blocks' },

  // ─── ALCHEMIST (144-150) — NEW ────────────────────────────────
  { id: 144, type: 'GROMBee',                  swarm: 'alchemist',  cslGate: 0.718, desc: 'Golden Ratio Optimization Method for param tuning' },
  { id: 145, type: 'ABExperimentBee',          swarm: 'alchemist',  cslGate: 0.618, desc: 'A/B test design, execution, and analysis' },
  { id: 146, type: 'CapabilityScoutBee',       swarm: 'alchemist',  cslGate: 0.618, desc: 'MCP registry scanning for new tool integration' },
  { id: 147, type: 'ToolForgerBee',            swarm: 'alchemist',  cslGate: 0.718, desc: 'Composite MCP tool generation from patterns' },
  { id: 148, type: 'MetricsBee',               swarm: 'alchemist',  cslGate: 0.0,   desc: 'System KPI tracking and regression detection' },
  { id: 149, type: 'AntiRegressionBee',        swarm: 'alchemist',  cslGate: 0.718, desc: 'pgvector guards preventing repeat failures' },
  { id: 150, type: 'WisdomCommitBee',          swarm: 'alchemist',  cslGate: 0.618, desc: 'Task learning extraction → knowledge graph' },
];

// ── Utility Functions ───────────────────────────────────────────────

export function getBeesBySwarm(swarmId) {
  return BEE_TYPES.filter(b => b.swarm === swarmId);
}

export function getBeeByType(typeName) {
  return BEE_TYPES.find(b => b.type === typeName);
}

export function getSwarm(swarmId) {
  return SWARMS.find(s => s.id === swarmId);
}

export function getBeesAboveGate(threshold) {
  return BEE_TYPES.filter(b => b.cslGate >= threshold);
}

export function getAlwaysActiveBees() {
  return BEE_TYPES.filter(b => b.cslGate === 0.0);
}

export function getSwarmStats() {
  return SWARMS.map(s => ({
    ...s,
    beeCount: BEE_TYPES.filter(b => b.swarm === s.id).length,
    alwaysActive: BEE_TYPES.filter(b => b.swarm === s.id && b.cslGate === 0.0).length,
    highGate: BEE_TYPES.filter(b => b.swarm === s.id && b.cslGate >= 0.718).length,
  }));
}

// ── Validation ──────────────────────────────────────────────────────

const _validate = () => {
  const types = new Set(BEE_TYPES.map(b => b.type));
  if (types.size !== BEE_TYPES.length) throw new Error('Duplicate bee types detected');
  if (BEE_TYPES.length > FIB[13]) throw new Error(`Exceeds MAX_BEE_TYPES (${FIB[13]})`);
  if (SWARMS.length > FIB[8]) throw new Error(`Exceeds MAX_SWARMS (${FIB[8]})`);
  for (const bee of BEE_TYPES) {
    if (!SWARMS.find(s => s.id === bee.swarm)) throw new Error(`Bee ${bee.type} references unknown swarm ${bee.swarm}`);
  }
};
_validate();

export default { SWARMS, BEE_TYPES, getBeesBySwarm, getBeeByType, getSwarm, getBeesAboveGate, getAlwaysActiveBees, getSwarmStats };
