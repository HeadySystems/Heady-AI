// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Concept Alignment & Activity Tracer v1.0.0               ║
// ║  Parses concepts-index.yaml, checks implementation directories, ║
// ║  maps codebase occurrences, and calculates alignment scores.     ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');

// Scan config
const CONCEPTS_PATH = join(REPO_ROOT, 'configs', 'concepts-index.yaml');
const SIGNALS_LEDGER_PATH = join(REPO_ROOT, '.data', 'task-ledger', 'signals-inventory.json');
const OUTPUT_REPORT_PATH = join(REPO_ROOT, 'docs', 'reports', 'concept-alignment-report.md');

const SCAN_DIRS = ['apps', 'packages', 'tooling', '.agents'];
const EXCLUDE_DIRS = ['node_modules', '.git', '.turbo', 'dist', '.data', 'artifacts', 'snapshots', 'tooling/data-consistency', 'docs/reports'];
const FILE_EXTS = ['.mjs', '.js', '.ts', '.json', '.hbs', '.md'];

// Recursive file walker
function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    return out;
  }
  for (const entry of entries) {
    const abs = join(dir, entry.name);
    const rel = relative(REPO_ROOT, abs).split(sep).join('/');
    
    if (EXCLUDE_DIRS.some(ex => rel === ex || rel.startsWith(`${ex}/`) || rel.split('/').includes(ex))) {
      continue;
    }
    
    if (entry.isDirectory()) {
      walk(abs, out);
    } else if (entry.isFile() && FILE_EXTS.some(ext => entry.name.endsWith(ext))) {
      out.push({ abs, rel });
    }
  }
  return out;
}

// Simple YAML Parser targeting concepts
function parseYamlConcepts(content) {
  const implemented = [];
  const planned = [];
  const lines = content.split('\n');
  let currentSection = null;
  let currentItem = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || trimmed === '') continue;

    if (trimmed.startsWith('implementedConcepts:')) {
      currentSection = implemented;
      continue;
    } else if (trimmed.startsWith('plannedConcepts:')) {
      currentSection = planned;
      continue;
    } else if (
      trimmed.startsWith('publicDomainPatterns:') || 
      trimmed.startsWith('swarmRegistry:') || 
      trimmed.startsWith('cslGates:') || 
      trimmed.startsWith('scoringTiers:')
    ) {
      currentSection = null;
      continue;
    }

    if (currentSection) {
      if (trimmed.startsWith('-')) {
        if (currentItem) {
          currentSection.push(currentItem);
        }
        currentItem = {};
        const rest = trimmed.slice(1).trim();
        const colonIdx = rest.indexOf(':');
        if (colonIdx > -1) {
          const key = rest.slice(0, colonIdx).trim();
          const val = rest.slice(colonIdx + 1).replace(/^['"]|['"]$/g, '').trim();
          currentItem[key] = val;
        }
      } else if (currentItem) {
        const colonIdx = trimmed.indexOf(':');
        if (colonIdx > -1) {
          const key = trimmed.slice(0, colonIdx).trim();
          const val = trimmed.slice(colonIdx + 1).replace(/^['"]|['"]$/g, '').trim();
          currentItem[key] = val;
        }
      }
    }
  }
  if (currentItem && currentSection) {
    currentSection.push(currentItem);
  }
  return { implemented, planned };
}

async function main() {
  console.log('HEADY™ Concept Alignment Tracer starting...');
  
  if (!existsSync(CONCEPTS_PATH)) {
    console.error(`Error: concepts-index.yaml not found at ${CONCEPTS_PATH}`);
    process.exit(1);
  }

  const rawYaml = readFileSync(CONCEPTS_PATH, 'utf8');
  const { implemented, planned } = parseYamlConcepts(rawYaml);
  console.log(`[Tracer] Loaded ${implemented.length} implemented and ${planned.length} planned concepts.`);

  // Load NATS signals ledger if exists
  let signalsLedger = { events: { publishers: {}, subscribers: {} }, apiRoutes: { usages: {} } };
  if (existsSync(SIGNALS_LEDGER_PATH)) {
    try {
      signalsLedger = JSON.parse(readFileSync(SIGNALS_LEDGER_PATH, 'utf8'));
      console.log('[Tracer] Loaded NATS and API routes signal ledger.');
    } catch (err) {
      console.warn(`[Tracer] Warning: could not parse signals ledger: ${err.message}`);
    }
  }

  const files = walk(REPO_ROOT);
  const activeConcepts = [];
  const staleConcepts = [];
  const orphanedConcepts = [];

  // 1. Verify Implemented Concepts
  for (const c of implemented) {
    if (c.status === 'orphaned') {
      orphanedConcepts.push(c);
      continue;
    }

    const locations = c.location ? c.location.split(',').map(l => l.trim()) : [];
    let verified = false;
    const resolvedPaths = [];

    for (const loc of locations) {
      const absPath = join(REPO_ROOT, loc);
      if (existsSync(absPath)) {
        verified = true;
        resolvedPaths.push(loc);
      }
    }

    if (verified) {
      activeConcepts.push({ ...c, resolvedPaths });
    } else {
      staleConcepts.push({ ...c, locations });
    }
  }

  // 2. Cross-reference Codebase Mentions
  const conceptMentions = {};
  for (const c of implemented) {
    conceptMentions[c.id] = [];
  }

  for (const file of files) {
    let content = '';
    try {
      content = readFileSync(file.abs, 'utf8');
    } catch {
      continue;
    }

    for (const c of implemented) {
      // Look for comments like @concept concept-id or simple id string mentions (case-insensitive where safe)
      const keyword = `@concept ${c.id}`;
      if (content.includes(keyword)) {
        const lineIdx = content.slice(0, content.indexOf(keyword)).split('\n').length;
        conceptMentions[c.id].push({ file: file.rel, line: lineIdx, type: 'explicit annotation' });
      }
    }
  }

  // 3. Map NATS event streams & API routing to Concept IDs
  const conceptActivity = {};
  for (const c of implemented) {
    conceptActivity[c.id] = { publishers: [], subscribers: [], apiRoutes: [], cslGatesCount: 0 };
  }

  // Map events based on naming conventions
  const pubEvents = Object.keys(signalsLedger.events.publishers);
  const subEvents = Object.keys(signalsLedger.events.subscribers);

  for (const event of pubEvents) {
    const clean = event.split(':').shift().trim();
    let mappedConcept = null;
    if (clean.includes('task') || clean.includes('pipeline')) mappedConcept = 'hcfullpipeline-runtime';
    else if (clean.includes('agent') || clean.includes('swarm')) mappedConcept = 'orchestrator-conductor';
    else if (clean.includes('csl') || clean.includes('gate')) mappedConcept = 'vector-routing';
    
    if (mappedConcept) {
      conceptActivity[mappedConcept].publishers.push({ event, files: signalsLedger.events.publishers[event] });
    }
  }

  for (const event of subEvents) {
    const clean = event.split(':').shift().trim();
    let mappedConcept = null;
    if (clean.includes('task') || clean.includes('pipeline')) mappedConcept = 'hcfullpipeline-runtime';
    else if (clean.includes('agent') || clean.includes('swarm')) mappedConcept = 'orchestrator-conductor';
    else if (clean.includes('csl') || clean.includes('gate')) mappedConcept = 'vector-routing';
    
    if (mappedConcept) {
      conceptActivity[mappedConcept].subscribers.push({ pattern: event, files: signalsLedger.events.subscribers[event] });
    }
  }

  // Map API Route operations to concepts
  const apiUsages = signalsLedger.apiRoutes.usages ?? {};
  for (const [op, usages] of Object.entries(apiUsages)) {
    let mappedConcept = null;
    if (op === 'getHealth') mappedConcept = 'operational-readiness';
    else if (op === 'enqueueTask' || op === 'getTask') mappedConcept = 'mcp-protocol';

    if (mappedConcept && usages.length > 0) {
      conceptActivity[mappedConcept].apiRoutes.push({ operationId: op, usages });
    }
  }

  // CSL Gate references from signals inventory
  const cslGates = signalsLedger.cslGates ?? [];
  conceptActivity['vector-routing'].cslGatesCount = cslGates.length;

  // 4. plannedConcepts checks (alert if targetLocation now exists)
  const readyPlanned = [];
  for (const p of planned) {
    if (p.targetLocation) {
      const absPath = join(REPO_ROOT, p.targetLocation);
      if (existsSync(absPath)) {
        readyPlanned.push(p);
      }
    }
  }

  // Calculate Alignment Score
  const totalTrackedActive = activeConcepts.length + staleConcepts.length;
  const alignmentScore = totalTrackedActive > 0 ? ((activeConcepts.length / totalTrackedActive) * 100).toFixed(1) : '100.0';

  // 5. Generate Markdown Report
  const mdReport = [];
  mdReport.push('<!-- ⚠️ GENERATED REPORT — DO NOT EDIT DIRECTLY -->');
  mdReport.push('# HEADY™ Concept Alignment & Activity Report');
  mdReport.push(`**Generated on:** ${new Date().toISOString()} · **Type:** Ontology Alignment`);
  mdReport.push('');
  mdReport.push('---');
  mdReport.push('');
  mdReport.push('## 1. Executive Summary');
  mdReport.push(`- **Concept Alignment Score:** \`${alignmentScore}%\``);
  mdReport.push(`- **Verified Active Concepts:** \`${activeConcepts.length}\``);
  mdReport.push(`- **Stale Concepts (Pending migration):** \`${staleConcepts.length}\``);
  mdReport.push(`- **Orphaned Concepts:** \`${orphanedConcepts.length}\``);
  mdReport.push('');

  if (staleConcepts.length > 0) {
    mdReport.push('### ⚠️ Stale Concepts Detected');
    mdReport.push('The following concepts are marked as `active` in `concepts-index.yaml` but their declared codebase paths do not exist in the rebuild monorepo:');
    for (const c of staleConcepts) {
      mdReport.push(`- **[${c.id}] ${c.name}** — expected: \`${c.locations.join(', ')}\``);
    }
    mdReport.push('');
  } else {
    mdReport.push('### ✅ Alignment Status: Perfect');
    mdReport.push('All registered active concepts resolve to verified files/folders on disk.');
    mdReport.push('');
  }

  if (readyPlanned.length > 0) {
    mdReport.push('### 🔔 Implemented Planned Concepts');
    mdReport.push('The following planned concepts have target directories that are now present in the codebase. Consider moving their status to `active`:');
    for (const p of readyPlanned) {
      mdReport.push(`- **[${p.id}] ${p.name}** — verified at: \`${p.targetLocation}\``);
    }
    mdReport.push('');
  }

  mdReport.push('---');
  mdReport.push('');
  mdReport.push('## 2. Active Concept Registry');
  mdReport.push('| Concept ID | Concept Name | Resolved Path | Mentions |');
  mdReport.push('|---|---|---|---|');
  for (const c of activeConcepts) {
    const mentions = conceptMentions[c.id] ?? [];
    const mentionStr = mentions.length > 0 ? mentions.map(m => `\`${m.file}:${m.line}\``).join('<br>') : '*None*';
    mdReport.push(`| \`${c.id}\` | ${c.name} | \`${c.resolvedPaths.join(', ')}\` | ${mentionStr} |`);
  }
  mdReport.push('');

  mdReport.push('## 3. Signal Activity Mapping');
  mdReport.push('Maps live communication patterns and event streams to their governing concepts.');
  mdReport.push('');

  for (const [conceptId, act] of Object.entries(conceptActivity)) {
    const hasActivity = act.publishers.length > 0 || act.subscribers.length > 0 || act.apiRoutes.length > 0 || act.cslGatesCount > 0;
    if (!hasActivity) continue;

    const conceptName = implemented.find(c => c.id === conceptId)?.name ?? conceptId;
    mdReport.push(`### Concept: ${conceptName} (\`${conceptId}\`)`);

    if (act.cslGatesCount > 0) {
      mdReport.push(`- **CSL Gates:** Verified \`${act.cslGatesCount}\` live gating points.`);
    }

    if (act.publishers.length > 0) {
      mdReport.push('- **Published Event Signals:**');
      for (const p of act.publishers) {
        mdReport.push(`  * \`${p.event}\` (via ${p.files.map(f => `\`${f.split(':')[0]}\``).join(', ')})`);
      }
    }

    if (act.subscribers.length > 0) {
      mdReport.push('- **Subscribed Event Signals:**');
      for (const s of act.subscribers) {
        mdReport.push(`  * \`${s.pattern}\` (via ${s.files.map(f => `\`${f.split(':')[0]}\``).join(', ')})`);
      }
    }

    if (act.apiRoutes.length > 0) {
      mdReport.push('- **Governed API Endpoints:**');
      for (const r of act.apiRoutes) {
        mdReport.push(`  * OpenAPI \`${r.operationId}\` (called at ${r.usages.map(u => `\`${u.split(':')[0]}\``).join(', ')})`);
      }
    }
    mdReport.push('');
  }

  // Save report
  writeFileSync(OUTPUT_REPORT_PATH, mdReport.join('\n'), 'utf8');
  console.log(`[Tracer] Wrote concept alignment report to docs/reports/concept-alignment-report.md`);
  console.log('HEADY™ Concept Alignment Tracer finished.');
}

main().catch(err => {
  console.error('[Tracer] Error:', err);
  process.exit(1);
});
