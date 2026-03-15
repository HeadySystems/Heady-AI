#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════════
// Auto-Success-Engine™ — Self-Driving Pipeline Task Executor
// ═══════════════════════════════════════════════════════════════════════════════
// Reads hcfullpipeline-tasks.json, identifies actionable tasks, executes fixes,
// and updates task statuses. φ-scaled execution with deterministic verification.
//
// Usage: node scripts/auto-success-engine.js [--dry-run] [--category FIX] [--id FIX-001]
//
// © 2026 HeadySystems Inc. — Eric Haywood, Founder
// ═══════════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PHI = 1.618033988749895;
const PIPELINE_PATH = path.join(__dirname, '..', 'configs', 'hcfullpipeline-tasks.json');

// ── Parse CLI args ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const CATEGORY_FILTER = args.includes('--category') ? args[args.indexOf('--category') + 1] : null;
const ID_FILTER = args.includes('--id') ? args[args.indexOf('--id') + 1] : null;
const VERBOSE = args.includes('--verbose') || args.includes('-v');

// ── Colors ──────────────────────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m',
  cyan: '\x1b[36m', magenta: '\x1b[35m', white: '\x1b[37m',
};

function log(msg, color = '') { console.log(`${color}${msg}${c.reset}`); }
function banner(msg) { log(`\n${'═'.repeat(70)}\n${msg}\n${'═'.repeat(70)}`, c.cyan + c.bold); }
function success(msg) { log(`  ✅ ${msg}`, c.green); }
function fail(msg) { log(`  ❌ ${msg}`, c.red); }
function info(msg) { log(`  ℹ️  ${msg}`, c.dim); }
function warn(msg) { log(`  ⚠️  ${msg}`, c.yellow); }

// ── Load Pipeline ───────────────────────────────────────────────────────────
function loadPipeline() {
  const raw = fs.readFileSync(PIPELINE_PATH, 'utf8');
  return JSON.parse(raw);
}

function savePipeline(pipeline) {
  fs.writeFileSync(PIPELINE_PATH, JSON.stringify(pipeline, null, 2) + '\n');
}

// ── Task Filters ────────────────────────────────────────────────────────────
function getPendingTasks(pipeline) {
  return pipeline.tasks.filter(t => {
    if (t.status !== 'pending') return false;
    if (CATEGORY_FILTER && t.category !== CATEGORY_FILTER) return false;
    if (ID_FILTER && t.id !== ID_FILTER) return false;
    return true;
  });
}

function getAutoFixableTasks(pipeline) {
  return getPendingTasks(pipeline).filter(t => t.auto_fix);
}

function getBlockedTasks(pipeline) {
  const completedIds = new Set(pipeline.tasks.filter(t => t.status === 'completed').map(t => t.id));
  return getPendingTasks(pipeline).filter(t => {
    if (!t.blockedBy || t.blockedBy.length === 0) return false;
    return t.blockedBy.some(dep => !completedIds.has(dep));
  });
}

// ── Execute Auto-Fix ────────────────────────────────────────────────────────
function executeAutoFix(task) {
  log(`\n  🔧 Executing: ${task.id} — ${task.title}`, c.magenta);
  info(`Auto-fix: ${task.auto_fix}`);

  if (DRY_RUN) {
    warn('DRY RUN — skipping execution');
    return { success: true, dry: true };
  }

  try {
    const output = execSync(task.auto_fix, {
      cwd: path.join(__dirname, '..'),
      timeout: 30000,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (VERBOSE && output.trim()) info(output.trim().split('\n').slice(0, 5).join('\n'));
    return { success: true, output: output.trim() };
  } catch (err) {
    return { success: false, error: err.message.split('\n')[0] };
  }
}

// ── Mark Task ───────────────────────────────────────────────────────────────
function markTask(pipeline, taskId, status) {
  const task = pipeline.tasks.find(t => t.id === taskId);
  if (task) {
    task.status = status;
    task.completedAt = new Date().toISOString();
    task.completedBy = 'auto-success-engine';
  }
}

// ── Report ──────────────────────────────────────────────────────────────────
function generateReport(pipeline) {
  const tasks = pipeline.tasks;
  const categories = {};

  tasks.forEach(t => {
    if (!categories[t.category]) categories[t.category] = { total: 0, completed: 0, pending: 0, failed: 0 };
    categories[t.category].total++;
    categories[t.category][t.status || 'pending']++;
  });

  banner('📊 Auto-Success-Engine Report');
  log(`  Pipeline: v${pipeline.version} | ${tasks.length} tasks | φ = ${PHI}`, c.white);
  log('');

  Object.entries(categories).forEach(([cat, stats]) => {
    const pct = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
    const bar = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));
    const color = pct === 100 ? c.green : pct > 50 ? c.yellow : c.red;
    log(`  ${cat.padEnd(16)} ${bar} ${pct}% (${stats.completed}/${stats.total})`, color);
  });

  const totalCompleted = tasks.filter(t => t.status === 'completed').length;
  const totalPct = Math.round((totalCompleted / tasks.length) * 100);
  log(`\n  ${'TOTAL'.padEnd(16)} ${'█'.repeat(Math.round(totalPct / 5))}${'░'.repeat(20 - Math.round(totalPct / 5))} ${totalPct}% (${totalCompleted}/${tasks.length})`, c.bold);

  const autoFixable = getAutoFixableTasks(pipeline);
  if (autoFixable.length > 0) {
    log(`\n  🔧 Auto-fixable tasks remaining: ${autoFixable.length}`, c.cyan);
    autoFixable.forEach(t => info(`${t.id}: ${t.title}`));
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  banner('🚀 Auto-Success-Engine™ v1.0.0');
  log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE EXECUTION'}`, DRY_RUN ? c.yellow : c.green);
  if (CATEGORY_FILTER) log(`  Filter: category=${CATEGORY_FILTER}`, c.cyan);
  if (ID_FILTER) log(`  Filter: id=${ID_FILTER}`, c.cyan);

  const pipeline = loadPipeline();
  log(`  Loaded: v${pipeline.version} — ${pipeline.tasks.length} tasks`, c.dim);

  const autoFixable = getAutoFixableTasks(pipeline);
  log(`  Auto-fixable pending tasks: ${autoFixable.length}`, c.white);

  let fixed = 0;
  let failed = 0;

  for (const task of autoFixable) {
    const result = executeAutoFix(task);
    if (result.success) {
      if (!result.dry) {
        markTask(pipeline, task.id, 'completed');
        fixed++;
      }
      success(`${task.id} — ${result.dry ? 'would complete' : 'COMPLETED'}`);
    } else {
      fail(`${task.id} — ${result.error}`);
      failed++;
    }
  }

  if (!DRY_RUN && fixed > 0) {
    pipeline.lastFineTuned = new Date().toISOString();
    savePipeline(pipeline);
    success(`Pipeline saved — ${fixed} tasks completed`);
  }

  generateReport(pipeline);

  log(`\n  Session: ${fixed} completed, ${failed} failed, ${autoFixable.length - fixed - failed} skipped`, c.bold);
  log(`  φ-scaled confidence: ${(fixed / Math.max(autoFixable.length, 1) * PHI).toFixed(3)}`, c.dim);
}

main().catch(err => { fail(err.message); process.exit(1); });
