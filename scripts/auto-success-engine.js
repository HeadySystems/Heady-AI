#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════════
// Auto-Success-Engine™ v2.0 — Self-Driving Pipeline Task Executor
// ═══════════════════════════════════════════════════════════════════════════════
// Reads hcfullpipeline-tasks.json, identifies actionable tasks, executes fixes,
// updates task statuses, auto-commits, and pushes to all Git remotes.
// φ-scaled execution with deterministic verification.
//
// Usage:
//   node scripts/auto-success-engine.js                      # Execute + commit + push
//   node scripts/auto-success-engine.js --dry-run             # Preview only
//   node scripts/auto-success-engine.js --category FIX        # Filter by category
//   node scripts/auto-success-engine.js --id FIX-001          # Execute single task
//   node scripts/auto-success-engine.js --no-push             # Commit but don't push
//   node scripts/auto-success-engine.js --report              # Report only, no execution
//   node scripts/auto-success-engine.js --add-task "title"    # Add a new task
//
// © 2026 HeadySystems Inc. — Eric Haywood, Founder
// ═══════════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PHI = 1.618033988749895;
const ROOT = path.join(__dirname, '..');
const PIPELINE_PATH = path.join(ROOT, 'configs', 'hcfullpipeline-tasks.json');
const GIT_REMOTES = ['headyai', 'hc-main']; // Push targets

// ── Parse CLI args ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const NO_PUSH = args.includes('--no-push');
const REPORT_ONLY = args.includes('--report');
const CATEGORY_FILTER = args.includes('--category') ? args[args.indexOf('--category') + 1] : null;
const ID_FILTER = args.includes('--id') ? args[args.indexOf('--id') + 1] : null;
const VERBOSE = args.includes('--verbose') || args.includes('-v');
const ADD_TASK = args.includes('--add-task') ? args[args.indexOf('--add-task') + 1] : null;
const MARK_DONE = args.includes('--mark-done') ? args[args.indexOf('--mark-done') + 1] : null;

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

// ── Load/Save Pipeline ─────────────────────────────────────────────────────
function loadPipeline() {
  return JSON.parse(fs.readFileSync(PIPELINE_PATH, 'utf8'));
}

function savePipeline(pipeline) {
  pipeline.lastFineTuned = new Date().toISOString();
  fs.writeFileSync(PIPELINE_PATH, JSON.stringify(pipeline, null, 2) + '\n');
}

// ── Git Operations ──────────────────────────────────────────────────────────
function gitCommit(message) {
  try {
    execSync('git add configs/hcfullpipeline-tasks.json', { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
    execSync(`git commit --no-verify -m "${message}"`, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
    success(`Git commit: ${message.split('\n')[0]}`);
    return true;
  } catch (err) {
    if (err.message.includes('nothing to commit')) {
      info('Nothing to commit — pipeline unchanged');
      return false;
    }
    fail(`Git commit failed: ${err.message.split('\n')[0]}`);
    return false;
  }
}

function gitPush() {
  if (NO_PUSH || DRY_RUN) {
    info('Push skipped (--no-push or --dry-run)');
    return;
  }
  for (const remote of GIT_REMOTES) {
    try {
      execSync(`git push ${remote} main --no-verify`, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe', timeout: 30000 });
      success(`Pushed to ${remote}`);
    } catch (err) {
      warn(`Push to ${remote} failed: ${err.message.split('\n')[0]}`);
    }
  }
}

// ── Task Operations ─────────────────────────────────────────────────────────
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

function markTask(pipeline, taskId, status) {
  const task = pipeline.tasks.find(t => t.id === taskId);
  if (task) {
    task.status = status;
    task.completedAt = new Date().toISOString();
    task.completedBy = 'auto-success-engine-v2';
    return true;
  }
  return false;
}

function addTask(pipeline, title, category = 'FIX', autoFix = null) {
  const existingIds = pipeline.tasks.filter(t => t.category === category).map(t => {
    const num = parseInt(t.id.split('-')[1]);
    return isNaN(num) ? 0 : num;
  });
  const nextNum = Math.max(0, ...existingIds) + 1;
  const id = `${category}-${String(nextNum).padStart(3, '0')}`;
  
  const task = {
    id,
    category,
    title,
    description: title,
    status: 'pending',
    csl_confidence: 0.882,
    estimated_hours: 1,
    source: `Auto-Success-Engine — ${new Date().toISOString().split('T')[0]}`,
  };
  if (autoFix) task.auto_fix = autoFix;
  
  pipeline.tasks.push(task);
  pipeline.taskCount = pipeline.tasks.length;
  
  // Update category count
  if (pipeline.categories[category]) {
    pipeline.categories[category].tasks = pipeline.tasks.filter(t => t.category === category).length;
  } else {
    pipeline.categories[category] = { csl_resonance: 1.0, tasks: 1 };
  }
  
  return task;
}

function executeAutoFix(task) {
  log(`\n  🔧 Executing: ${task.id} — ${task.title}`, c.magenta);
  info(`Auto-fix: ${task.auto_fix}`);

  if (DRY_RUN) {
    warn('DRY RUN — skipping execution');
    return { success: true, dry: true };
  }

  try {
    const output = execSync(task.auto_fix, {
      cwd: ROOT,
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

// ── Report ──────────────────────────────────────────────────────────────────
function generateReport(pipeline) {
  const tasks = pipeline.tasks;
  const categories = {};

  tasks.forEach(t => {
    if (!categories[t.category]) categories[t.category] = { total: 0, completed: 0, pending: 0, failed: 0 };
    categories[t.category].total++;
    categories[t.category][t.status || 'pending']++;
  });

  banner('📊 Auto-Success-Engine™ v2.0 Report');
  log(`  Pipeline: v${pipeline.version} | ${tasks.length} tasks | φ = ${PHI}`, c.white);
  log(`  Last updated: ${pipeline.lastFineTuned}`, c.dim);
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
    autoFixable.slice(0, 10).forEach(t => info(`${t.id}: ${t.title}`));
    if (autoFixable.length > 10) info(`... and ${autoFixable.length - 10} more`);
  }

  // Blocked tasks
  const completedIds = new Set(tasks.filter(t => t.status === 'completed').map(t => t.id));
  const blocked = tasks.filter(t => t.status === 'pending' && t.blockedBy && t.blockedBy.some(dep => !completedIds.has(dep)));
  if (blocked.length > 0) {
    log(`\n  🚫 Blocked tasks: ${blocked.length}`, c.yellow);
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  banner('🚀 Auto-Success-Engine™ v2.0');
  const mode = REPORT_ONLY ? 'REPORT ONLY' : DRY_RUN ? 'DRY RUN' : 'LIVE EXECUTION';
  log(`  Mode: ${mode}`, DRY_RUN || REPORT_ONLY ? c.yellow : c.green);
  log(`  Git: commit=${!DRY_RUN && !REPORT_ONLY} push=${!NO_PUSH && !DRY_RUN && !REPORT_ONLY}`, c.dim);
  if (CATEGORY_FILTER) log(`  Filter: category=${CATEGORY_FILTER}`, c.cyan);
  if (ID_FILTER) log(`  Filter: id=${ID_FILTER}`, c.cyan);

  const pipeline = loadPipeline();
  log(`  Loaded: v${pipeline.version} — ${pipeline.tasks.length} tasks`, c.dim);

  // ── Handle --mark-done ──
  if (MARK_DONE) {
    if (markTask(pipeline, MARK_DONE, 'completed')) {
      success(`Marked ${MARK_DONE} as completed`);
      savePipeline(pipeline);
      gitCommit(`✅ ${MARK_DONE} completed — auto-success-engine`);
      gitPush();
    } else {
      fail(`Task ${MARK_DONE} not found`);
    }
    generateReport(pipeline);
    return;
  }

  // ── Handle --add-task ──
  if (ADD_TASK) {
    const category = CATEGORY_FILTER || 'FIX';
    const task = addTask(pipeline, ADD_TASK, category);
    success(`Added: ${task.id} — ${task.title}`);
    savePipeline(pipeline);
    gitCommit(`➕ ${task.id}: ${task.title} — auto-success-engine`);
    gitPush();
    generateReport(pipeline);
    return;
  }

  // ── Report only ──
  if (REPORT_ONLY) {
    generateReport(pipeline);
    return;
  }

  // ── Execute auto-fixable tasks ──
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

  // ── Save + Commit + Push ──
  if (!DRY_RUN && fixed > 0) {
    savePipeline(pipeline);
    success(`Pipeline saved — ${fixed} tasks completed`);

    const commitMsg = `🤖 Auto-Success-Engine: ${fixed} tasks completed\n\n` +
      autoFixable.filter(t => pipeline.tasks.find(tt => tt.id === t.id)?.status === 'completed')
        .map(t => `- ${t.id}: ${t.title}`).join('\n') +
      `\n\nPipeline: v${pipeline.version} | ${pipeline.tasks.filter(t => t.status === 'completed').length}/${pipeline.tasks.length} completed`;

    const committed = gitCommit(commitMsg);
    if (committed) gitPush();
  }

  generateReport(pipeline);

  log(`\n  Session: ${fixed} completed, ${failed} failed, ${autoFixable.length - fixed - failed} skipped`, c.bold);
  log(`  φ-scaled confidence: ${(fixed / Math.max(autoFixable.length, 1) * PHI).toFixed(3)}`, c.dim);
}

main().catch(err => { fail(err.message); process.exit(1); });
