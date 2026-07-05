// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Service Category Map v1.0.0                               ║
// ║  Single source for the headyme.com navigation IA — plain-language ║
// ║  labels + one-sentence blurbs for every SERVICE_CATALOG entry.    ║
// ║  Keyed by SERVICE NAME so unknown catalog entries degrade into    ║
// ║  the visible "More" group instead of breaking the nav.            ║
// ║  Spec: docs/blueprints/headyme-navigation-ia.md                   ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝

export const FALLBACK_CATEGORY = 'more';

/** Ordered category definitions — 7 comprehensible groups + More fallback. */
export const CATEGORIES = {
  ask:        { label: 'Ask & Chat',          glyph: '💬', blurb: 'Talk with Heady — questions, quick answers, deep research.' },
  create:     { label: 'Create & Code',       glyph: '🛠', blurb: 'Generate code, content, music, and creative work.' },
  understand: { label: 'Understand & Review', glyph: '🔍', blurb: 'Analyze code, images, and patterns; compare results.' },
  find:       { label: 'Find & Remember',     glyph: '🧭', blurb: 'Search knowledge, recall memory, sync your notes.' },
  safety:     { label: 'Safety & Quality',    glyph: '🛡', blurb: 'Security scans, quality checks, integrity monitoring.' },
  operate:    { label: 'Run & Maintain',      glyph: '⚙', blurb: 'Deploy, automate, clean up, watch system health.' },
  tools:      { label: 'Hands-On Tools',      glyph: '🖥', blurb: 'Browser, terminal, and data tools Heady can drive for you.' },
  more:       { label: 'More',                glyph: '◌', blurb: 'Newer services not yet categorized — still fully usable.' },
};

export const CATEGORY_ORDER = ['ask', 'create', 'understand', 'find', 'safety', 'operate', 'tools', 'more'];

/**
 * Per-service metadata: { category, label, blurb }.
 * Names mirror SERVICE_CATALOG in src/hc_service_dispatcher.js (40 services).
 * The blurb IS the one-sentence explanation HeadyBuddy speaks (§5.1 of the IA
 * spec) — the resolve endpoint carries no description field.
 */
export const SERVICE_META = {
  // ── Ask & Chat ────────────────────────────────────────────────────
  chat:       { category: 'ask', label: 'Chat with Heady', blurb: 'Ask anything and get a straight answer from the Heady brain.' },
  buddy:      { category: 'ask', label: 'HeadyBuddy', blurb: 'Your personal assistant with memory across every device.' },
  jules:      { category: 'ask', label: 'Deep Thinking', blurb: 'Slow, careful reasoning for hard or layered questions.' },
  compute:    { category: 'ask', label: 'General AI', blurb: 'General-purpose AI that can also call tools and functions.' },
  fast:       { category: 'ask', label: 'Instant Answers', blurb: 'The fastest lane when you need a quick response.' },
  research:   { category: 'ask', label: 'Deep Research', blurb: 'Web-wide research with sources you can check.' },
  edge:       { category: 'ask', label: 'Edge AI', blurb: 'Answers served from the closest network edge for speed.' },

  // ── Create & Code ─────────────────────────────────────────────────
  coder:      { category: 'create', label: 'Code Generator', blurb: 'Writes and scaffolds code from a plain description.' },
  codex:      { category: 'create', label: 'Code Transformer', blurb: 'Rewrites, converts, and documents existing code.' },
  copilot:    { category: 'create', label: 'Inline Suggestions', blurb: 'Context-aware code completions while you work.' },
  pythia:     { category: 'create', label: 'Multimodal Studio', blurb: 'Generates and understands images alongside text.' },
  vinci:      { category: 'create', label: 'Creative Predictor', blurb: 'Learns your patterns and predicts creative next steps.' },
  daw:        { category: 'create', label: 'DAW Bridge', blurb: 'Connects Heady to your music software over MIDI and OSC.' },
  midi:       { category: 'create', label: 'MIDI Tools', blurb: 'Turns MIDI notes and controls into data Heady can use.' },
  spatial:    { category: 'create', label: 'Spatial Context', blurb: 'Places sound and objects in 3D space for creative work.' },

  // ── Understand & Review ───────────────────────────────────────────
  analyze:    { category: 'understand', label: 'Code & Text Analysis', blurb: 'Reviews code or text and explains what it finds.' },
  patterns:   { category: 'understand', label: 'Pattern Finder', blurb: 'Spots design patterns and architecture in your code.' },
  soul:       { category: 'understand', label: 'Quality Reflection', blurb: 'Heady critiques its own output before you rely on it.' },
  lens:       { category: 'understand', label: 'Visual Analysis', blurb: 'Looks at images and screenshots and tells you what is there.' },
  battle:     { category: 'understand', label: 'Model Arena', blurb: 'Runs several AIs on the same task and shows you the winner.' },
  'deep-scan': { category: 'understand', label: 'Project Deep Scan', blurb: 'Maps a whole project so Heady understands it deeply.' },

  // ── Find & Remember ───────────────────────────────────────────────
  search:     { category: 'find', label: 'Knowledge Search', blurb: 'Finds answers inside everything Heady knows.' },
  memory:     { category: 'find', label: 'Memory Recall', blurb: 'Searches Heady’s 3D memory for things you’ve seen before.' },
  embed:      { category: 'find', label: 'Embeddings', blurb: 'Turns text into vectors so meaning becomes searchable.' },
  notion:     { category: 'find', label: 'Notion Sync', blurb: 'Keeps your Notion knowledge in sync with Heady.' },
  huggingface: { category: 'find', label: 'Model Hub', blurb: 'Looks up and runs AI models from the Hugging Face hub.' },

  // ── Safety & Quality ──────────────────────────────────────────────
  risks:      { category: 'safety', label: 'Security Scan', blurb: 'Scans for vulnerabilities and rates the risk.' },
  qa:         { category: 'safety', label: 'Quality Checks', blurb: 'Probes endpoints and validates everything still works.' },
  scientist:  { category: 'safety', label: 'Integrity Monitor', blurb: 'Watches for drift and confirms results stay deterministic.' },

  // ── Run & Maintain ────────────────────────────────────────────────
  ops:        { category: 'operate', label: 'Deploy', blurb: 'Ships services to the cloud and manages infrastructure.' },
  maid:       { category: 'operate', label: 'Cleanup', blurb: 'Tidies workspaces and handles scheduled housekeeping.' },
  maintenance: { category: 'operate', label: 'Backups & Upkeep', blurb: 'Health monitoring, backup, and restore in one place.' },
  'auto-flow': { category: 'operate', label: 'Auto Pipeline', blurb: 'Runs the full multi-stage pipeline end to end.' },
  'auto-success': { category: 'operate', label: 'Auto-Success Engine', blurb: 'Shows what the always-on optimization engine is doing.' },
  orchestrator: { category: 'operate', label: 'Task Router', blurb: 'Sends work to the right agent or swarm automatically.' },
  liquid:     { category: 'operate', label: 'Liquid State', blurb: 'Live view of how work is flowing through the system.' },
  health:     { category: 'operate', label: 'System Health', blurb: 'One-glance status of every Heady service.' },

  // ── Hands-On Tools ────────────────────────────────────────────────
  browser:    { category: 'tools', label: 'Web Browser', blurb: 'Heady drives a real browser to navigate and test sites.' },
  terminal:   { category: 'tools', label: 'Terminal', blurb: 'Runs shell commands for you in a safe sandbox.' },
  datacloud:  { category: 'tools', label: 'Data Cloud', blurb: 'Queries BigQuery and Spanner with plain SQL.' },
};

/** "auto-flow" → "Auto Flow" — honest fallback label for unmapped names. */
export function titleize(name) {
  return String(name || '')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Metadata for any service name — mapped services get their curated entry;
 * unknown services degrade into the More group with a synthesized blurb.
 * @param {string} name
 * @param {string[]} [capabilities] from the live catalog, for the fallback blurb
 */
export function serviceMeta(name, capabilities = []) {
  const known = SERVICE_META[name];
  if (known) return { ...known, name, curated: true };
  const caps = Array.isArray(capabilities) ? capabilities.filter((c) => typeof c === 'string') : [];
  return {
    name,
    category: FALLBACK_CATEGORY,
    label: titleize(name),
    blurb: caps.length
      ? `Provides ${caps.slice(0, 3).join(', ')} — not yet categorized.`
      : 'New Heady service — not yet categorized.',
    curated: false,
  };
}

/** One sentence HeadyBuddy speaks when explaining a resolved destination. */
export function describeService(name, capabilities = []) {
  const meta = serviceMeta(name, capabilities);
  return `${meta.label} — ${meta.blurb}`;
}

/**
 * Group a live catalog (GET /api/service/catalog → services[]) into ordered
 * category buckets. Empty categories are omitted; unknown names land in More.
 * @param {Array<{name:string, endpoint:string, method:string, capabilities?:string[], component?:string}>} services
 * @returns {Array<{key:string, label:string, glyph:string, blurb:string, services:Array<object>}>}
 */
export function buildGroups(services) {
  const buckets = new Map(CATEGORY_ORDER.map((key) => [key, []]));
  for (const svc of services || []) {
    if (!svc || typeof svc.name !== 'string') continue;
    const meta = serviceMeta(svc.name, svc.capabilities);
    const key = buckets.has(meta.category) ? meta.category : FALLBACK_CATEGORY;
    buckets.get(key).push({ ...svc, ...meta });
  }
  return CATEGORY_ORDER
    .filter((key) => buckets.get(key).length > 0)
    .map((key) => ({ key, ...CATEGORIES[key], services: buckets.get(key) }));
}
