// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Communication & Signals Tracer v1.0.0                    ║
// ║  Parses imports, NATS pub/sub, CSL gates, and API routes to      ║
// ║  build a detailed dependency, route, and signal inventory.       ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, relative, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');

// Directories to scan
const SCAN_DIRS = ['apps', 'packages', 'tooling', '.agents'];
const EXCLUDE_DIRS = ['node_modules', '.git', '.turbo', 'dist', '.data', 'artifacts', 'snapshots', 'tooling/data-consistency', 'docs/reports'];
const FILE_EXTS = ['.mjs', '.js', '.ts', '.json', '.hbs', '.md'];

// Helper to check if subject matches pattern (NATS wildcards)
function subjectMatches(pattern, subject) {
  if (pattern === subject) return true;
  const p = pattern.split('.');
  const s = subject.split('.');
  for (let i = 0; i < p.length; i++) {
    if (p[i] === '>') return s.length >= i + 1;
    if (i >= s.length) return false;
    if (p[i] === '*') continue;
    if (p[i] !== s[i]) return false;
  }
  return p.length === s.length;
}

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

// Find package name for a given rel path
function getPackageName(relPath) {
  const parts = relPath.split('/');
  if (parts[0] === 'packages' && parts[1]) {
    return `@heady/${parts[1]}`;
  }
  if (parts[0] === 'apps' && parts[1]) {
    return `@apps/${parts[1]}`;
  }
  if (parts[0] === 'tooling' && parts[1]) {
    return `@tooling/${parts[1]}`;
  }
  if (parts[0] === '.agents') {
    return '@agents';
  }
  return 'root';
}

// Simple Circular Dependency Detector
function findCircularDependencies(depsMap) {
  const visited = new Set();
  const stack = new Set();
  const circular = [];

  function dfs(node, path = []) {
    if (stack.has(node)) {
      const idx = path.indexOf(node);
      circular.push([...path.slice(idx), node]);
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    stack.add(node);
    path.push(node);

    const neighbors = depsMap[node] ?? [];
    for (const neighbor of neighbors) {
      dfs(neighbor, path);
    }

    path.pop();
    stack.delete(node);
  }

  for (const node of Object.keys(depsMap)) {
    dfs(node);
  }

  return circular;
}

// Parse OpenAPI spec
function parseOpenApi() {
  const specPath = join(REPO_ROOT, 'packages', 'contracts', 'openapi', 'heady.openapi.json');
  if (!existsSync(specPath)) return { paths: [], operations: [] };
  try {
    const raw = readFileSync(specPath, 'utf8');
    const spec = JSON.parse(raw);
    const paths = [];
    const operations = [];
    
    for (const [path, item] of Object.entries(spec.paths ?? {})) {
      for (const [method, op] of Object.entries(item)) {
        if (op?.operationId) {
          paths.push({ method: method.toUpperCase(), path, operationId: op.operationId, summary: op.summary });
          operations.push(op.operationId);
        }
      }
    }
    return { paths, operations };
  } catch (err) {
    console.error(`[Tracer] Failed to parse OpenAPI spec: ${err.message}`);
    return { paths: [], operations: [] };
  }
}

async function main() {
  console.log('HEADY™ Signal Tracer starting...');
  const files = walk(REPO_ROOT);
  console.log(`[Tracer] Scanned ${files.length} source files.`);

  // State maps
  const moduleImports = {}; // pkg -> Set of package dependencies
  const publishers = {};   // event -> Array of files
  const subscribers = {};  // eventPattern -> Array of files
  const cslGates = [];     // Array of locations [{ file, line }]
  const apiRouteUsage = {}; // operationId -> Array of files referencing it

  // Get OpenAPI operations
  const { paths: openApiPaths, operations: openApiOps } = parseOpenApi();
  for (const op of openApiOps) {
    apiRouteUsage[op] = [];
  }

  // Regex patterns
  const importRegex = /import\s+.*?\s+from\s+['"](@heady\/[^'"]+|(?:\.\.?\/)[^'"]+)['"]/g;
  const publishRegex = /(?:\.publish|publish)\s*\(\s*['"]([^'"]+)['"]/g;
  const subscribeRegex = /(?:\.subscribe|subscribe)\s*\(\s*['"]([^'"]+)['"]/g;
  const cslGateRegex = /\bcslGate\s*\(/g;
  
  // SUBJECT.action("xxx") etc.
  const subjectHelperRegex = /SUBJECT\s*\.\s*(action|observation|agent|system)\s*\(\s*['"]([^'"]+)['"]/g;

  // Scan every file
  for (const file of files) {
    // Only scan text contents of source files (code / config)
    if (file.rel.includes('.git/') || file.rel.includes('node_modules/') || file.rel.endsWith('.png') || file.rel.endsWith('.jpg')) {
      continue;
    }

    let content = '';
    try {
      content = readFileSync(file.abs, 'utf8');
    } catch {
      continue;
    }

    const pkg = getPackageName(file.rel);
    if (!moduleImports[pkg]) moduleImports[pkg] = new Set();

    // 1. Imports
    let match;
    importRegex.lastIndex = 0;
    while ((match = importRegex.exec(content)) !== null) {
      const dep = match[1];
      if (dep.startsWith('@heady/') && dep !== pkg) {
        moduleImports[pkg].add(dep);
      }
    }

    // 2. Publishes
    publishRegex.lastIndex = 0;
    while ((match = publishRegex.exec(content)) !== null) {
      const event = match[1];
      if (!publishers[event]) publishers[event] = [];
      publishers[event].push(file.rel);
    }

    // 3. Subscribes
    subscribeRegex.lastIndex = 0;
    while ((match = subscribeRegex.exec(content)) !== null) {
      const eventPattern = match[1];
      if (!subscribers[eventPattern]) subscribers[eventPattern] = [];
      subscribers[eventPattern].push(file.rel);
    }

    // 4. Subject helpers
    subjectHelperRegex.lastIndex = 0;
    while ((match = subjectHelperRegex.exec(content)) !== null) {
      const helper = match[1];
      const kind = match[2];
      let resolvedSubject = '';
      if (helper === 'action') resolvedSubject = `heady.action.${kind}`;
      else if (helper === 'observation') resolvedSubject = `heady.observation.${kind}`;
      else if (helper === 'agent') resolvedSubject = `agent.${kind}`;
      else if (helper === 'system') resolvedSubject = `heady.system.${kind}`;

      // Check context of helper to guess if it's publish or subscribe
      const lineIdx = content.slice(0, match.index).split('\n').length - 1;
      const lines = content.split('\n');
      const line = lines[lineIdx];
      
      if (line.includes('publish') || line.includes('emit') || line.includes('send')) {
        if (!publishers[resolvedSubject]) publishers[resolvedSubject] = [];
        publishers[resolvedSubject].push(`${file.rel}:${lineIdx + 1}`);
      } else if (line.includes('subscribe') || line.includes('on(') || line.includes('handler')) {
        if (!subscribers[resolvedSubject]) subscribers[resolvedSubject] = [];
        subscribers[resolvedSubject].push(`${file.rel}:${lineIdx + 1}`);
      } else {
        // Log both as potential usages
        if (!publishers[resolvedSubject]) publishers[resolvedSubject] = [];
        publishers[resolvedSubject].push(`${file.rel}:${lineIdx + 1} (inferred pub)`);
        if (!subscribers[resolvedSubject]) subscribers[resolvedSubject] = [];
        subscribers[resolvedSubject].push(`${file.rel}:${lineIdx + 1} (inferred sub)`);
      }
    }

    // 5. CSL Gates
    cslGateRegex.lastIndex = 0;
    while ((match = cslGateRegex.exec(content)) !== null) {
      const lineIdx = content.slice(0, match.index).split('\n').length;
      cslGates.push({ file: file.rel, line: lineIdx });
    }

    // 6. OpenAPI Operations references
    for (const op of openApiOps) {
      if (content.includes(op) && !file.rel.includes('openapi/')) {
        const lineIdx = content.slice(0, content.indexOf(op)).split('\n').length;
        apiRouteUsage[op].push(`${file.rel}:${lineIdx}`);
      }
    }
  }

  // Convert Set to Array for imports
  const serializableImports = {};
  for (const [pkg, deps] of Object.entries(moduleImports)) {
    serializableImports[pkg] = Array.from(deps);
  }

  // Circular dependencies check
  const circularDeps = findCircularDependencies(serializableImports);

  // Consistency check: Find Orphan Events
  // An orphan is published but never matched by any subscriber, or subscribed to but never matched by any publisher.
  const orphanPublishers = [];
  const orphanSubscribers = [];

  const allEventPatterns = Object.keys(subscribers);
  const allPublishedEvents = Object.keys(publishers);

  for (const pubEvent of allPublishedEvents) {
    const cleanEvent = pubEvent.split(':').shift().trim(); // Strip line details
    const hasMatch = allEventPatterns.some(pat => subjectMatches(pat, cleanEvent));
    if (!hasMatch) {
      orphanPublishers.push({ event: pubEvent, sources: publishers[pubEvent] });
    }
  }

  for (const subPat of allEventPatterns) {
    const hasMatch = allPublishedEvents.some(pub => subjectMatches(subPat, pub.split(':').shift().trim()));
    if (!hasMatch) {
      orphanSubscribers.push({ pattern: subPat, subscribers: subscribers[subPat] });
    }
  }

  // Consistency check: Unguarded endpoints
  // Find operations that do not appear in files where cslGate is called
  const unguardedOps = [];
  for (const op of openApiOps) {
    const usages = apiRouteUsage[op];
    const hasGate = usages.some(u => {
      const file = u.split(':')[0];
      return cslGates.some(g => g.file === file);
    });
    if (usages.length > 0 && !hasGate) {
      unguardedOps.push({ operationId: op, usages });
    }
  }

  // Build JSON Payload
  const payload = {
    timestamp: new Date().toISOString(),
    moduleImports: serializableImports,
    circularDependencies: circularDeps,
    events: {
      publishers,
      subscribers,
      orphans: {
        publishers: orphanPublishers,
        subscribers: orphanSubscribers
      }
    },
    cslGates,
    apiRoutes: {
      definitions: openApiPaths,
      usages: apiRouteUsage,
      unguarded: unguardedOps
    }
  };

  // Write JSON
  const ledgerDir = join(REPO_ROOT, '.data', 'task-ledger');
  if (!existsSync(ledgerDir)) {
    mkdirSync(ledgerDir, { recursive: true });
  }
  writeFileSync(join(ledgerDir, 'signals-inventory.json'), JSON.stringify(payload, null, 2), 'utf8');
  console.log('[Tracer] Wrote JSON ledger to .data/task-ledger/signals-inventory.json');

  // Build Markdown Report
  const mdReport = [];
  mdReport.push('<!-- ⚠️ GENERATED REPORT — DO NOT EDIT DIRECTLY -->');
  mdReport.push('# HEADY™ Ecosystem Routing and Signals Inventory');
  mdReport.push(`**Generated on:** ${new Date().toISOString()} · **Type:** Static Analysis`);
  mdReport.push('');
  mdReport.push('---');
  mdReport.push('');
  mdReport.push('## 1. Quality & Consistency Health Check');
  mdReport.push('');

  // Circular dependencies reporting
  if (circularDeps.length > 0) {
    mdReport.push('### ✗ Circular Dependencies Detected');
    for (const cycle of circularDeps) {
      mdReport.push(`- \`${cycle.join(' → ')}\``);
    }
  } else {
    mdReport.push('### ✅ Dependency Architecture: Clean');
    mdReport.push('No circular package dependencies detected.');
  }
  mdReport.push('');

  // Event Orphans reporting
  if (orphanPublishers.length > 0 || orphanSubscribers.length > 0) {
    mdReport.push('### ▲ Event Bus Signal Integrity Anomalies');
    
    if (orphanPublishers.length > 0) {
      mdReport.push('#### Published Events without Active Subscribers:');
      for (const item of orphanPublishers) {
        mdReport.push(`- \`${item.event}\` (Published by: ${item.sources.map(s => `\`${s}\``).join(', ')})`);
      }
    }
    
    if (orphanSubscribers.length > 0) {
      mdReport.push('#### Subscribed Patterns matching no Published Events:');
      for (const item of orphanSubscribers) {
        mdReport.push(`- \`${item.pattern}\` (Subscribed by: ${item.subscribers.map(s => `\`${s}\``).join(', ')})`);
      }
    }
  } else {
    mdReport.push('### ✅ Event Bus Signal Integrity: 100%');
    mdReport.push('All published events match active subscribers, and all subscribers map to published events.');
  }
  mdReport.push('');

  // CSL Gating Audit
  mdReport.push('### 🔒 CSL Gating & Endpoint Auditing');
  mdReport.push(`Total active CSL gates detected: **${cslGates.length}**`);
  if (unguardedOps.length > 0) {
    mdReport.push('#### Endpoints lacking CSL gate protections in their calling files:');
    for (const item of unguardedOps) {
      mdReport.push(`- Operation: \`${item.operationId}\` (Referenced at: ${item.usages.map(u => `\`${u}\``).join(', ')})`);
    }
  } else {
    mdReport.push('#### ✅ All API endpoints operate under CSL-gated contexts.');
  }
  mdReport.push('');

  mdReport.push('---');
  mdReport.push('');
  mdReport.push('## 2. API Routes & OpenApi Contracts');
  mdReport.push('| Method | Path | OperationId | Referencing Files |');
  mdReport.push('|---|---|---|---|');
  for (const path of openApiPaths) {
    const usages = apiRouteUsage[path.operationId] ?? [];
    const usageStr = usages.length > 0 ? usages.map(u => u.split(':')[0]).join('<br>') : '*Unused*';
    mdReport.push(`| \`${path.method}\` | \`${path.path}\` | \`${path.operationId}\` | ${usageStr} |`);
  }
  mdReport.push('');

  mdReport.push('## 3. Package Imports Dependency Matrix');
  mdReport.push('| Package | Imports From |');
  mdReport.push('|---|---|');
  for (const [pkg, deps] of Object.entries(serializableImports)) {
    mdReport.push(`| \`${pkg}\` | ${deps.length > 0 ? deps.map(d => `\`${d}\``).join(', ') : '*None*'} |`);
  }
  mdReport.push('');

  // Write Markdown Report
  const reportsDir = join(REPO_ROOT, 'docs', 'reports');
  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir, { recursive: true });
  }
  writeFileSync(join(reportsDir, 'communication-signals-inventory.md'), mdReport.join('\n'), 'utf8');
  console.log('[Tracer] Wrote Markdown report to docs/reports/communication-signals-inventory.md');
  console.log('HEADY™ Signal Tracer finished.');
}

main().catch(err => {
  console.error('[Tracer] Error:', err);
  process.exit(1);
});
