// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Studio Registry v1.0.0                                    ║
// ║  Single source of truth for the Heady Studio MCP host: models,     ║
// ║  modes, effort tiers, execution modes, skills, workflows, Heady     ║
// ║  services, external MCP servers, and billing-aware feature flags.   ║
// ║  Every UI option is an entry here — add a row, it shows up.         ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝
import { z } from 'zod';
import { PHI, PSI, PSI2, FIB, CSL_THRESHOLDS } from '@heady/phi-math';

// ── φ-derived billing units ─────────────────────────────────────────
// One "credit" is the base meter unit. Tiers are φ-scaled so cost steps
// follow the golden ratio rather than arbitrary magic numbers. Toggling a
// feature off removes its weight from the per-message meter (the user's
// "adjust charges accordingly" requirement).
const CREDIT_BASE = 1;
const tier = (n) => Math.round(CREDIT_BASE * PHI ** n * 100) / 100; // tier(0)=1, tier(1)=1.62 …

// ── Models ──────────────────────────────────────────────────────────
// Real, current model IDs. `creditWeight` meters per-1k-output-tokens.
export const MODELS = Object.freeze([
  { id: 'claude-opus-4-8',            label: 'Claude Opus 4.8',   provider: 'anthropic', envKey: 'ANTHROPIC_API_KEY', context: 1_000_000, creditWeight: tier(3), default: true,  tags: ['flagship', 'reasoning'] },
  { id: 'claude-sonnet-4-6',          label: 'Claude Sonnet 4.6', provider: 'anthropic', envKey: 'ANTHROPIC_API_KEY', context: 1_000_000, creditWeight: tier(2), default: false, tags: ['balanced'] },
  { id: 'claude-haiku-4-5-20251001',  label: 'Claude Haiku 4.5',  provider: 'anthropic', envKey: 'ANTHROPIC_API_KEY', context: 200_000,   creditWeight: tier(1), default: false, tags: ['fast', 'cheap'] },
  { id: 'claude-fable-5',             label: 'Claude Fable 5',    provider: 'anthropic', envKey: 'ANTHROPIC_API_KEY', context: 200_000,   creditWeight: tier(2), default: false, tags: ['creative'] },
  { id: 'llama-3.3-70b-versatile',    label: 'Groq Llama 3.3 70B',provider: 'groq',      envKey: 'GROQ_API_KEY',     context: 128_000,   creditWeight: tier(1), default: false, tags: ['fast', 'oss'] },
]);

// ── Reasoning modes (the user's deep-research / recommendation / understanding) ──
export const MODES = Object.freeze([
  { id: 'understanding',  label: 'Understanding',  glyph: '◎', creditWeight: tier(0), description: 'Explain and map the problem space before acting.' },
  { id: 'recommendation', label: 'Recommendation', glyph: '✦', creditWeight: tier(1), description: 'Surface ranked, actionable suggestions for the current context.' },
  { id: 'deep-research',  label: 'Deep Research',  glyph: '🜂', creditWeight: tier(2), description: 'Fan-out multi-source research, verify, synthesize a cited answer.' },
]);

// ── Effort tiers — φ-scaled iteration / token budgets, no magic numbers ──
export const EFFORT_LEVELS = Object.freeze([
  { id: 'minimal', label: 'Minimal', maxIterations: FIB[2], creditWeight: tier(0) }, // 1
  { id: 'low',     label: 'Low',     maxIterations: FIB[3], creditWeight: tier(0) }, // 2
  { id: 'medium',  label: 'Medium',  maxIterations: FIB[5], creditWeight: tier(1), default: true }, // 5
  { id: 'high',    label: 'High',    maxIterations: FIB[7], creditWeight: tier(2) }, // 13
  { id: 'max',     label: 'Max',     maxIterations: FIB[8], creditWeight: tier(3) }, // 21
]);

// ── Execution modes — auto vs testing/review vs sandbox ─────────────
export const EXECUTION_MODES = Object.freeze([
  { id: 'auto',           label: 'Auto',           glyph: '∞', description: 'Proceed as recommended; apply reversible changes automatically.', gatesMutations: false },
  { id: 'testing-review', label: 'Testing / Review',glyph: '⚖', description: 'Propose every change; nothing is applied until you approve.',      gatesMutations: true,  default: true },
  { id: 'sandbox',        label: 'Sandbox',        glyph: '⌗', description: 'Run generated code only in the in-browser WASM WebContainer.',     gatesMutations: true,  sandboxOnly: true },
]);

// ── Skills (selectable; mirror /heady-* slash commands) ─────────────
export const SKILLS = Object.freeze([
  { id: 'heady-research',       label: 'Research',        creditWeight: tier(1) },
  { id: 'heady-code-generation',label: 'Code Generation', creditWeight: tier(1) },
  { id: 'heady-security-audit', label: 'Security Audit',  creditWeight: tier(1) },
  { id: 'heady-deep-scan',      label: 'Deep Scan',       creditWeight: tier(2) },
  { id: 'heady-task-decomposition', label: 'Task Decomposition', creditWeight: tier(0) },
]);

// ── Workflows (selectable multi-step pipelines) ─────────────────────
export const WORKFLOWS = Object.freeze([
  { id: 'heady-auto-flow',   label: 'Auto Flow (analyze→generate→validate)', creditWeight: tier(2) },
  { id: 'heady-checkpoint',  label: 'Checkpoint Protocol',                   creditWeight: tier(1) },
  { id: 'heady-pipeline',    label: 'HCFullPipeline',                        creditWeight: tier(2) },
]);

// ── Heady services (togglable; each is a capability behind headymcp.com/mcp) ──
// `permanent: true` ⇒ mandatory per AGENTS.md systemic-services governance and
// cannot be billed off (it is always on); discretionary ones drive billing.
export const HEADY_SERVICES = Object.freeze([
  { id: 'autocontext',  label: 'AutoContext (5-pass)',    permanent: true,  creditWeight: tier(0), tool: 'heady_autocontext_enrich' },
  { id: 'governance',   label: 'Governance',              permanent: true,  creditWeight: tier(0), tool: 'heady_governance_check' },
  { id: 'memory',       label: 'Persistent Memory',       permanent: false, creditWeight: tier(1), tool: 'heady_memory_search', default: true },
  { id: 'orchestration',label: 'Orchestration',           permanent: false, creditWeight: tier(2), tool: 'heady_orchestrate',    default: true },
  { id: 'recommendation',label:'Recommendation Engine',   permanent: false, creditWeight: tier(1), tool: 'heady_recommend',      default: true },
  { id: 'security',     label: 'Security / CodeLock',     permanent: false, creditWeight: tier(1), tool: 'heady_security_audit' },
  { id: 'deep-scan',    label: 'Deep Scan',               permanent: false, creditWeight: tier(2), tool: 'heady_deep_scan' },
]);

// ── External MCP server presets (togglable; connect by URL via the /mcp convention) ──
// Heady's own services ride the single multiplexed gateway (headymcp.com/mcp);
// external servers are connected by their own Streamable-HTTP `/mcp` endpoint.
export const EXTERNAL_MCP_PRESETS = Object.freeze([
  { id: 'github', label: 'GitHub',     transport: 'http', urlEnv: 'MCP_GITHUB_URL', creditWeight: tier(1), default: true },
  { id: 'slack',  label: 'Slack',      transport: 'http', urlEnv: 'MCP_SLACK_URL',  creditWeight: tier(1) },
  { id: 'linear', label: 'Linear',     transport: 'http', urlEnv: 'MCP_LINEAR_URL', creditWeight: tier(1) },
  { id: 'sentry', label: 'Sentry',     transport: 'http', urlEnv: 'MCP_SENTRY_URL', creditWeight: tier(1) },
  { id: 'stripe', label: 'Stripe',     transport: 'http', urlEnv: 'MCP_STRIPE_URL', creditWeight: tier(1) },
]);

// ── Repo connectors — popular locations + Heady-ecosystem-specified ──
export const REPO_CONNECTORS = Object.freeze([
  { id: 'github',      label: 'GitHub repository',       kind: 'remote', via: 'github-mcp' },
  { id: 'heady-eco',   label: 'Heady ecosystem repo',    kind: 'remote', via: 'github-mcp', org: 'HeadySystems' },
  { id: 'local-fs',    label: 'Local / mounted filesystem', kind: 'local', via: 'filesystem-mcp' },
]);

// ── Billing model ───────────────────────────────────────────────────
export const BILLING = Object.freeze({
  currency: 'HeadyCredits',
  // Discretionary features (permanent services excluded — they are always on).
  // A message's per-turn meter = model + mode + effort + Σ enabled discretionary features.
  meterNote: 'Per-message credits = model + mode + effort + Σ(enabled discretionary services, skills, workflows, external MCP).',
});

// ── Zod schemas (validation at boundaries; AGENTS.md rule #5) ────────
const Weighted = z.object({ id: z.string().min(1), label: z.string().min(1), creditWeight: z.number().nonnegative() }).passthrough();
export const ManifestSchema = z.object({
  version: z.string(),
  generatedAt: z.string(),
  models: z.array(Weighted),
  modes: z.array(Weighted),
  effort: z.array(z.object({ id: z.string(), label: z.string(), maxIterations: z.number().int().positive(), creditWeight: z.number().nonnegative() }).passthrough()),
  executionModes: z.array(z.object({ id: z.string(), label: z.string() }).passthrough()),
  skills: z.array(Weighted),
  workflows: z.array(Weighted),
  headyServices: z.array(Weighted),
  externalMcp: z.array(z.object({ id: z.string(), label: z.string() }).passthrough()),
  repoConnectors: z.array(z.object({ id: z.string(), label: z.string() }).passthrough()),
  billing: z.object({ currency: z.string() }).passthrough(),
});

// ── Manifest builder (what the gateway serves and the SPA renders) ──
export function buildManifest() {
  const manifest = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    models: MODELS,
    modes: MODES,
    effort: EFFORT_LEVELS,
    executionModes: EXECUTION_MODES,
    skills: SKILLS,
    workflows: WORKFLOWS,
    headyServices: HEADY_SERVICES,
    externalMcp: EXTERNAL_MCP_PRESETS,
    repoConnectors: REPO_CONNECTORS,
    billing: BILLING,
  };
  return ManifestSchema.parse(manifest);
}

const byId = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]));
const CATALOG = {
  models: byId(MODELS), modes: byId(MODES), effort: byId(EFFORT_LEVELS),
  skills: byId(SKILLS), workflows: byId(WORKFLOWS), headyServices: byId(HEADY_SERVICES),
  externalMcp: byId(EXTERNAL_MCP_PRESETS),
};

/**
 * Estimate the per-message credit meter for a given selection. Permanent Heady
 * services never add cost (always on); everything the user toggled does.
 * @param {{model?:string, mode?:string, effort?:string, skills?:string[], workflows?:string[], headyServices?:string[], externalMcp?:string[]}} sel
 */
export function estimateBilling(sel = {}) {
  const lines = [];
  const add = (kind, entry) => { if (entry) lines.push({ kind, id: entry.id, label: entry.label, credits: entry.permanent ? 0 : entry.creditWeight }); };
  add('model', CATALOG.models[sel.model]);
  add('mode', CATALOG.modes[sel.mode]);
  add('effort', CATALOG.effort[sel.effort]);
  for (const s of sel.skills ?? []) add('skill', CATALOG.skills[s]);
  for (const w of sel.workflows ?? []) add('workflow', CATALOG.workflows[w]);
  for (const h of sel.headyServices ?? []) add('heady-service', CATALOG.headyServices[h]);
  for (const m of sel.externalMcp ?? []) add('external-mcp', CATALOG.externalMcp[m]);
  const total = Math.round(lines.reduce((s, l) => s + l.credits, 0) * 100) / 100;
  return { currency: BILLING.currency, total, lines };
}

/**
 * Lightweight recommendation engine. Scores candidate next-actions against the
 * user's current input + selection using a φ-weighted lexical-overlap heuristic
 * (cosine via @heady/perspective is the pluggable upgrade path — same shape).
 * Returns ranked suggestions above the CSL LOW gate so weak matches are dropped.
 * @param {{input?:string, mode?:string, selection?:object}} ctx
 */
export function recommend(ctx = {}) {
  const input = String(ctx.input ?? '').toLowerCase();
  const tokens = new Set(input.split(/[^a-z0-9]+/).filter(Boolean));
  const candidates = [
    { id: 'enable-deep-research', kind: 'mode',     label: 'Switch to Deep Research', terms: ['research', 'investigate', 'compare', 'sources', 'why', 'analyze'] },
    { id: 'connect-github',       kind: 'connector',label: 'Connect a GitHub repo',   terms: ['repo', 'github', 'code', 'pr', 'commit', 'branch', 'file'] },
    { id: 'run-security-audit',   kind: 'skill',    label: 'Run Security Audit',      terms: ['secret', 'auth', 'token', 'vulnerability', 'security', 'cve'] },
    { id: 'enable-memory',        kind: 'service',  label: 'Recall from persistent memory', terms: ['remember', 'earlier', 'last', 'previous', 'memory', 'context'] },
    { id: 'decompose-task',       kind: 'skill',    label: 'Decompose into a task plan', terms: ['build', 'implement', 'plan', 'steps', 'feature', 'app'] },
    { id: 'use-sandbox',          kind: 'exec-mode',label: 'Preview in Sandbox',       terms: ['run', 'preview', 'demo', 'try', 'widget', 'ui'] },
  ];
  const scored = candidates.map((c) => {
    const hits = c.terms.filter((t) => tokens.has(t) || input.includes(t)).length;
    // φ-normalized score in [0,1]; empty input → gentle baseline so the panel is never blank.
    const raw = tokens.size === 0 ? PSI2 : hits / (hits + PHI);
    return { id: c.id, kind: c.kind, label: c.label, score: Math.round(raw * 1000) / 1000 };
  });
  return scored
    .filter((c) => c.score >= CSL_THRESHOLDS.LOW * PSI || tokens.size === 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, FIB[5]); // top 5
}

export const REGISTRY_VERSION = '1.0.0';
