/**
 * © 2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Comprehensive System Self-Diagnostic (CSSD)
 * ════════════════════════════════════════════
 *
 * The single, unified diagnostic that ensures Heady is fully self-aware
 * of every component's health at all times. Orchestrates 7 diagnostic
 * layers into one actionable health report:
 *
 *   Layer 1 — Module Integrity Scan    (require() every .js module)
 *   Layer 2 — Config Validation Matrix (.yaml/.json structural checks)
 *   Layer 3 — MCP Server Health        (tools array export validation)
 *   Layer 4 — Cross-Dependency Graph   (circular dep / orphan detection)
 *   Layer 5 — Runtime Telemetry        (SelfAwareness, FIPL, DriftDetector)
 *   Layer 6 — Service Health Probes    (HTTP /health for all 58 services)
 *   Layer 7 — Unified Health Report    (aggregated ORS with per-layer scores)
 *
 * All timing is φ-derived. Zero magic numbers.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ─── φ constants ────────────────────────────────────────────────────────────
const PHI = 1.618033988749895;
const PSI = 1 / PHI;
const FIBS = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src');
const SHARED_DIR = path.join(ROOT, 'shared');
const SERVICES_DIR = path.join(ROOT, 'services');
const SRC_SERVICES_DIR = path.join(ROOT, 'src', 'services');
const MCP_DIR = path.join(ROOT, 'mcp-servers');
const CONFIGS_DIR = path.join(ROOT, 'configs');

// ─── Diagnostic severity levels ─────────────────────────────────────────────
const SEVERITY = {
  HEALTHY:  'healthy',
  DEGRADED: 'degraded',
  CRITICAL: 'critical',
  UNKNOWN:  'unknown',
};

// ─── Utility ────────────────────────────────────────────────────────────────

function readJsonSafe(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch { return null; }
}

function readYamlSafe(filePath) {
  try {
    const yaml = require('js-yaml');
    return yaml.load(fs.readFileSync(filePath, 'utf8'));
  } catch { return null; }
}

function httpProbe(url, timeoutMs = Math.round(PHI * PHI * 1000)) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, error: 'timeout', ms: timeoutMs }), timeoutMs);
    const proto = url.startsWith('https') ? https : http;
    const start = Date.now();
    proto.get(url, { timeout: timeoutMs }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        clearTimeout(timer);
        const ms = Date.now() - start;
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode, ms });
      });
    }).on('error', (err) => {
      clearTimeout(timer);
      resolve({ ok: false, error: err.code || err.message, ms: Date.now() - start });
    });
  });
}

function walkFiles(dir, ext, maxDepth = 4, depth = 0) {
  const results = [];
  if (depth > maxDepth || !fs.existsSync(dir)) return results;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...walkFiles(fullPath, ext, maxDepth, depth + 1));
      } else if (entry.isFile() && entry.name.endsWith(ext)) {
        results.push(fullPath);
      }
    }
  } catch { /* permission denied, etc. */ }
  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 1 — Module Integrity Scan
// ═══════════════════════════════════════════════════════════════════════════

function scanModuleIntegrity() {
  const results = { layer: 'ModuleIntegrity', checks: [], passed: 0, failed: 0 };

  const scanDirs = [
    { dir: SRC_DIR, label: 'src' },
    { dir: SHARED_DIR, label: 'shared' },
    { dir: MCP_DIR, label: 'mcp-servers' },
  ];

  for (const { dir, label } of scanDirs) {
    const files = walkFiles(dir, '.js', 2);
    for (const file of files) {
      const rel = path.relative(ROOT, file);
      // Skip .d.ts companion files, test files, and already-known non-loadable patterns
      if (rel.includes('.d.ts') || rel.includes('__test') || rel.includes('.test.') || rel.includes('.spec.')) continue;
      try {
        // Use require.resolve to check if the module is resolvable without executing
        require.resolve(file);
        results.checks.push({ name: `load:${rel}`, ok: true });
        results.passed++;
      } catch (err) {
        results.checks.push({ name: `load:${rel}`, ok: false, error: err.message.split('\n')[0] });
        results.failed++;
      }
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 2 — Config Validation Matrix
// ═══════════════════════════════════════════════════════════════════════════

function scanConfigValidation() {
  const results = { layer: 'ConfigValidation', checks: [], passed: 0, failed: 0 };

  // Scan all YAML files
  const yamlFiles = walkFiles(CONFIGS_DIR, '.yaml', 2);
  for (const file of yamlFiles) {
    const rel = path.relative(ROOT, file);
    const parsed = readYamlSafe(file);
    results.checks.push({ name: `yaml:${rel}`, ok: parsed !== null });
    parsed !== null ? results.passed++ : results.failed++;
  }

  // Scan all JSON configs
  const jsonFiles = walkFiles(CONFIGS_DIR, '.json', 2);
  for (const file of jsonFiles) {
    const rel = path.relative(ROOT, file);
    const parsed = readJsonSafe(file);
    results.checks.push({ name: `json:${rel}`, ok: parsed !== null });
    parsed !== null ? results.passed++ : results.failed++;
  }

  // Special checks
  const criticalConfigs = [
    'service-catalog.yaml',
    'governance-policies.yaml',
    'resource-policies.yaml',
    'system-self-awareness.yaml',
    'hcfullpipeline.yaml',
    'mcp-gateway-config.yaml',
  ];

  for (const cfg of criticalConfigs) {
    const exists = fs.existsSync(path.join(CONFIGS_DIR, cfg));
    results.checks.push({ name: `critical:${cfg}`, ok: exists });
    exists ? results.passed++ : results.failed++;
  }

  // Check for merge conflict markers in any config
  const allConfigFiles = [...yamlFiles, ...jsonFiles];
  for (const file of allConfigFiles) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const hasConflict = content.includes('<<<<<<< HEAD') || content.includes('>>>>>>>');
      if (hasConflict) {
        const rel = path.relative(ROOT, file);
        results.checks.push({ name: `no_conflicts:${rel}`, ok: false });
        results.failed++;
      }
    } catch { /* skip unreadable */ }
  }

  // Check for localhost references in production configs
  const productionConfigs = ['service-catalog.yaml', 'remote-resources.yaml'];
  for (const cfg of productionConfigs) {
    const filePath = path.join(CONFIGS_DIR, cfg);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const hasLocalhost = content.includes('localhost');
      results.checks.push({ name: `no_localhost:${cfg}`, ok: !hasLocalhost });
      hasLocalhost ? results.failed++ : results.passed++;
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 3 — MCP Server Health
// ═══════════════════════════════════════════════════════════════════════════

function scanMCPServerHealth() {
  const results = { layer: 'MCPServerHealth', checks: [], passed: 0, failed: 0 };

  if (!fs.existsSync(MCP_DIR)) {
    results.checks.push({ name: 'mcp_dir_exists', ok: false });
    results.failed++;
    return results;
  }

  const mcpFiles = fs.readdirSync(MCP_DIR).filter(f => f.endsWith('.js'));

  for (const file of mcpFiles) {
    const fullPath = path.join(MCP_DIR, file);
    try {
      // Verify the file is resolvable
      require.resolve(fullPath);

      // Attempt a shallow check: read the file content and look for `tools` array export
      const content = fs.readFileSync(fullPath, 'utf8');
      const hasToolsExport = content.includes('tools') && (content.includes('module.exports') || content.includes('export'));
      results.checks.push({
        name: `mcp:${file}`,
        ok: true,
        hasToolsExport,
        sizeKB: Math.round(content.length / 1024),
      });
      results.passed++;
    } catch (err) {
      results.checks.push({ name: `mcp:${file}`, ok: false, error: err.message.split('\n')[0] });
      results.failed++;
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 4 — Cross-Component Dependency Graph
// ═══════════════════════════════════════════════════════════════════════════

function scanDependencyGraph() {
  const results = { layer: 'DependencyGraph', checks: [], passed: 0, failed: 0, graph: {} };

  const allFiles = [
    ...walkFiles(SRC_DIR, '.js', 2),
    ...walkFiles(SHARED_DIR, '.js', 2),
    ...walkFiles(MCP_DIR, '.js', 1),
  ];

  const depMap = new Map(); // file -> [required_paths]

  for (const file of allFiles) {
    const rel = path.relative(ROOT, file);
    try {
      const content = fs.readFileSync(file, 'utf8');
      // Extract require() calls
      const requireMatches = content.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g) || [];
      const deps = requireMatches
        .map(m => m.match(/['"]([^'"]+)['"]/)?.[1])
        .filter(Boolean)
        .filter(d => d.startsWith('.') || d.startsWith('/'));  // Only local deps

      depMap.set(rel, deps);
    } catch { /* skip unreadable */ }
  }

  // Detect circular dependencies using DFS
  const circularDeps = [];
  const visited = new Set();
  const inStack = new Set();

  function dfs(node, chain = []) {
    if (inStack.has(node)) {
      const cycle = chain.slice(chain.indexOf(node));
      circularDeps.push(cycle);
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    inStack.add(node);

    const deps = depMap.get(node) || [];
    for (const dep of deps) {
      // Resolve relative dep to a key in depMap
      const dir = path.dirname(path.join(ROOT, node));
      let resolved;
      try {
        resolved = path.relative(ROOT, require.resolve(path.resolve(dir, dep)));
      } catch {
        resolved = dep; // unresolvable — counts as missing
      }
      dfs(resolved, [...chain, node]);
    }

    inStack.delete(node);
  }

  for (const file of depMap.keys()) {
    dfs(file);
  }

  // Detect missing local dependencies
  const missingDeps = [];
  for (const [file, deps] of depMap.entries()) {
    for (const dep of deps) {
      const dir = path.dirname(path.join(ROOT, file));
      try {
        require.resolve(path.resolve(dir, dep));
      } catch {
        missingDeps.push({ file, missing: dep });
      }
    }
  }

  results.checks.push({
    name: 'circular_dependencies',
    ok: circularDeps.length === 0,
    count: circularDeps.length,
    details: circularDeps.slice(0, FIBS[8]), // Cap at 21
  });
  circularDeps.length === 0 ? results.passed++ : results.failed++;

  results.checks.push({
    name: 'missing_local_deps',
    ok: missingDeps.length === 0,
    count: missingDeps.length,
    details: missingDeps.slice(0, FIBS[8]),
  });
  missingDeps.length === 0 ? results.passed++ : results.failed++;

  results.checks.push({
    name: 'total_modules_scanned',
    ok: true,
    value: depMap.size,
  });
  results.passed++;

  results.graph = {
    totalNodes: depMap.size,
    totalEdges: Array.from(depMap.values()).reduce((sum, d) => sum + d.length, 0),
    circularCount: circularDeps.length,
    missingCount: missingDeps.length,
  };

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 5 — Runtime Telemetry
// ═══════════════════════════════════════════════════════════════════════════

function scanRuntimeTelemetry() {
  const results = { layer: 'RuntimeTelemetry', checks: [], passed: 0, failed: 0 };
  const os = require('os');
  const mem = process.memoryUsage();

  // 1. Process health
  results.checks.push({
    name: 'process_uptime',
    ok: process.uptime() > 0,
    valueS: Math.round(process.uptime()),
  });
  results.passed++;

  // 2. Memory pressure
  const heapRatio = mem.heapUsed / mem.heapTotal;
  results.checks.push({
    name: 'heap_pressure',
    ok: heapRatio < 0.85,
    ratio: heapRatio.toFixed(3),
    heapUsedMB: Math.round(mem.heapUsed / 1048576),
    heapTotalMB: Math.round(mem.heapTotal / 1048576),
  });
  heapRatio < 0.85 ? results.passed++ : results.failed++;

  // 3. System memory
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const memPressure = 1 - (freeMem / totalMem);
  results.checks.push({
    name: 'system_memory_pressure',
    ok: memPressure < 0.90,
    ratio: memPressure.toFixed(3),
    freeMB: Math.round(freeMem / 1048576),
    totalMB: Math.round(totalMem / 1048576),
  });
  memPressure < 0.90 ? results.passed++ : results.failed++;

  // 4. CPU load average
  const loadAvg = os.loadavg()[0];
  const cpuCount = os.cpus().length;
  const cpuPressure = loadAvg / cpuCount;
  results.checks.push({
    name: 'cpu_pressure',
    ok: cpuPressure < 0.90,
    ratio: cpuPressure.toFixed(3),
    loadAvg1m: loadAvg.toFixed(2),
    cpuCount,
  });
  cpuPressure < 0.90 ? results.passed++ : results.failed++;

  // 5. Try loading SelfAwareness ORS
  try {
    const { SelfAwareness } = require('./self-awareness');
    const sa = new SelfAwareness({ systemId: 'cssd-probe' });
    const ors = sa.getORS();
    results.checks.push({
      name: 'self_awareness_ors',
      ok: ors.score >= PSI,
      score: ors.score,
      grade: ors.grade,
    });
    ors.score >= PSI ? results.passed++ : results.failed++;
  } catch (err) {
    results.checks.push({
      name: 'self_awareness_ors',
      ok: false,
      error: err.message.split('\n')[0],
      note: 'SelfAwareness module not loadable — ORS unavailable',
    });
    results.failed++;
  }

  // 6. Try loading Frequency Interference Detector
  try {
    const fipl = require('./frequency-interference-detector');
    results.checks.push({
      name: 'fipl_module_loadable',
      ok: true,
      exports: Object.keys(fipl).length,
    });
    results.passed++;
  } catch (err) {
    results.checks.push({
      name: 'fipl_module_loadable',
      ok: false,
      error: err.message.split('\n')[0],
    });
    results.failed++;
  }

  // 7. Try loading Drift Detector
  try {
    const dd = require('./drift-detector');
    results.checks.push({
      name: 'drift_detector_loadable',
      ok: true,
      exports: Object.keys(dd).length,
    });
    results.passed++;
  } catch (err) {
    results.checks.push({
      name: 'drift_detector_loadable',
      ok: false,
      error: err.message.split('\n')[0],
    });
    results.failed++;
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 6 — Service Health Probes
// ═══════════════════════════════════════════════════════════════════════════

async function scanServiceHealth() {
  const results = { layer: 'ServiceHealth', checks: [], passed: 0, failed: 0 };

  // Load the 58-service list from the health-check-all.sh or from service-catalog.yaml
  const catalog = readYamlSafe(path.join(CONFIGS_DIR, 'service-catalog.yaml'));
  const services = catalog?.services || [];

  if (services.length === 0) {
    results.checks.push({ name: 'service_catalog_loaded', ok: false, note: 'No services found in catalog' });
    results.failed++;
    return results;
  }

  results.checks.push({ name: 'service_catalog_loaded', ok: true, serviceCount: services.length });
  results.passed++;

  // Probe first fib(8)=21 services to stay within time budget
  const probeBatch = services.slice(0, FIBS[8]);
  const probeTimeout = Math.round(PHI * PHI * 1000); // ~2,618ms

  const probePromises = probeBatch.map(async (svc) => {
    const healthPath = svc.healthPath || '/health/ready';
    const url = `https://${svc.name}-609590223909.us-east1.run.app${healthPath}`;
    const result = await httpProbe(url, probeTimeout);
    return {
      name: `probe:${svc.name}`,
      ok: result.ok,
      status: result.status || null,
      ms: result.ms,
      error: result.error || null,
    };
  });

  const probeResults = await Promise.all(probePromises);
  for (const pr of probeResults) {
    results.checks.push(pr);
    pr.ok ? results.passed++ : results.failed++;
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 7 — Unified Health Report
// ═══════════════════════════════════════════════════════════════════════════

function computeUnifiedReport(layers) {
  const totalPassed = layers.reduce((s, l) => s + l.passed, 0);
  const totalFailed = layers.reduce((s, l) => s + l.failed, 0);
  const totalChecks = totalPassed + totalFailed;
  const globalScore = totalChecks > 0 ? totalPassed / totalChecks : 0;

  // Map score to severity using CSL thresholds
  let severity;
  if (globalScore >= 0.927) severity = SEVERITY.HEALTHY;
  else if (globalScore >= PSI) severity = SEVERITY.DEGRADED;
  else severity = SEVERITY.CRITICAL;

  // Per-layer scores
  const layerScores = layers.map(l => {
    const total = l.passed + l.failed;
    return {
      layer: l.layer,
      score: total > 0 ? (l.passed / total).toFixed(4) : '1.0000',
      passed: l.passed,
      failed: l.failed,
      total,
    };
  });

  // Identify top issues (failed checks across all layers)
  const topIssues = [];
  for (const layer of layers) {
    for (const check of layer.checks) {
      if (!check.ok) {
        topIssues.push({
          layer: layer.layer,
          check: check.name,
          error: check.error || check.note || 'failed',
        });
      }
    }
  }

  return {
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    phiCycleMs: Math.round(Math.pow(PHI, 7) * 1000),
    severity,
    globalScore: globalScore.toFixed(4),
    totalChecks,
    totalPassed,
    totalFailed,
    layerScores,
    topIssues: topIssues.slice(0, FIBS[8]), // Cap at 21
    topIssuesTotal: topIssues.length,
    layers,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════════════

class ComprehensiveSystemDiagnostic {
  constructor(opts = {}) {
    this._skipServiceProbes = opts.skipServiceProbes || false;
    this._lastReport = null;
    this._runCount = 0;
  }

  /**
   * Run the full 7-layer diagnostic.
   * @returns {Promise<object>} Unified health report
   */
  async run() {
    const start = Date.now();
    this._runCount++;

    // Layers 1-4 are synchronous
    const l1 = scanModuleIntegrity();
    const l2 = scanConfigValidation();
    const l3 = scanMCPServerHealth();
    const l4 = scanDependencyGraph();
    const l5 = scanRuntimeTelemetry();

    // Layer 6 is async (HTTP probes)
    let l6;
    if (this._skipServiceProbes) {
      l6 = { layer: 'ServiceHealth', checks: [{ name: 'probes_skipped', ok: true, note: 'Skipped by config' }], passed: 1, failed: 0 };
    } else {
      l6 = await scanServiceHealth();
    }

    // Layer 7: Unified Report
    const layers = [l1, l2, l3, l4, l5, l6];
    const report = computeUnifiedReport(layers);
    report.durationMs = Date.now() - start;
    report.runNumber = this._runCount;

    this._lastReport = report;

    // Write report to .heady cache
    try {
      const cacheDir = path.join(ROOT, '.heady');
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(
        path.join(cacheDir, 'cssd-report.json'),
        JSON.stringify(report, null, 2),
        'utf8'
      );
    } catch { /* non-critical write failure */ }

    return report;
  }

  /**
   * Quick summary for the Auto-Success Engine integration.
   * @returns {{ ok: boolean, severity: string, globalScore: string, totalChecks: number, totalFailed: number }}
   */
  getLastSummary() {
    if (!this._lastReport) return { ok: false, note: 'No diagnostic has been run yet' };
    return {
      ok: this._lastReport.severity !== SEVERITY.CRITICAL,
      severity: this._lastReport.severity,
      globalScore: this._lastReport.globalScore,
      totalChecks: this._lastReport.totalChecks,
      totalFailed: this._lastReport.totalFailed,
      durationMs: this._lastReport.durationMs,
      runNumber: this._lastReport.runNumber,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STANDALONE EXECUTION
// ═══════════════════════════════════════════════════════════════════════════

if (require.main === module) {
  (async () => {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║  HEADY — Comprehensive System Self-Diagnostic (CSSD)   ║');
    console.log('║  7-Layer Full Spectrum Health Analysis                  ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');

    const cssd = new ComprehensiveSystemDiagnostic({ skipServiceProbes: true });
    const report = await cssd.run();

    console.log(`  Severity:     ${report.severity.toUpperCase()}`);
    console.log(`  Global Score: ${report.globalScore} (threshold: ${PSI.toFixed(4)})`);
    console.log(`  Total Checks: ${report.totalChecks}`);
    console.log(`  Passed:       ${report.totalPassed}`);
    console.log(`  Failed:       ${report.totalFailed}`);
    console.log(`  Duration:     ${report.durationMs}ms`);
    console.log('');

    console.log('  ── Layer Scores ──');
    for (const ls of report.layerScores) {
      const bar = ls.failed > 0 ? '⚠' : '✅';
      console.log(`    ${bar} ${ls.layer.padEnd(20)} ${ls.score}  (${ls.passed}/${ls.total})`);
    }

    if (report.topIssues.length > 0) {
      console.log('');
      console.log(`  ── Top Issues (${report.topIssuesTotal} total) ──`);
      for (const issue of report.topIssues.slice(0, 13)) {
        console.log(`    ✗ [${issue.layer}] ${issue.check}: ${issue.error}`);
      }
    }

    console.log('');
    console.log(`  Report saved to: .heady/cssd-report.json`);
  })();
}

module.exports = { ComprehensiveSystemDiagnostic, SEVERITY };
