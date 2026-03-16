// ═══════════════════════════════════════════════════════════════════════════════
// Pipeline Stage Implementations — PL-001, PL-002, PL-003, PL-007, PL-008
// Stages: channel-entry, recon, trial-and-error
// © 2026 HeadySystems Inc. — 60+ Provisional Patents
// ═══════════════════════════════════════════════════════════════════════════════

import { textToEmbedding, cslAND } from '../shared/csl-engine-v2.js';
import { createHash } from 'crypto';
import { existsSync, statSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const PHI = 1.618033988749895;

function safeExec(cmd, cwd) {
  try {
    return { stdout: execSync(cmd, { cwd, timeout: 10000, encoding: 'utf8', stdio: ['pipe','pipe','pipe'] }).trim(), success: true };
  } catch { return { stdout: '', success: false }; }
}

// ─── PL-001: scan_3d_persistent_vector_storage (Stage 0: channel-entry) ─────

export function scanVectorStorage(rootDir = process.cwd()) {
  const vectorPaths = [
    '.heady/autocontext-vectors.jsonl',
    'data/memory/embeddings.jsonl',
    'data/memory/codebase-vectors.jsonl',
  ];

  const results = [];
  for (const rel of vectorPaths) {
    const full = join(rootDir, rel);
    if (existsSync(full)) {
      const stats = statSync(full);
      const ageDays = (Date.now() - stats.mtimeMs) / 86400000;
      const lines = readFileSync(full, 'utf8').split('\n').filter(Boolean).length;
      results.push({
        path: rel,
        exists: true,
        vectors: lines,
        sizeMB: Math.round(stats.size / 1024 / 1024 * 100) / 100,
        ageDays: Math.round(ageDays * 10) / 10,
        stale: ageDays > 21, // fib(8) = 21 day freshness window
      });
    } else {
      results.push({ path: rel, exists: false, vectors: 0, stale: true });
    }
  }

  // Check Qdrant collections if endpoint is set
  const qdrantUrl = process.env.QDRANT_URL || 'https://qdrant.headysystems.com';
  let qdrantStatus = 'NOT_CHECKED';
  try {
    const health = execSync(`curl -sf ${qdrantUrl}/healthz 2>/dev/null`, { encoding: 'utf8', timeout: 5000 });
    qdrantStatus = health.includes('ok') || health.includes('200') ? 'ALIVE' : 'DEGRADED';
  } catch { qdrantStatus = 'UNREACHABLE'; }

  return {
    stage: 0,
    task: 'scan_3d_persistent_vector_storage',
    localFiles: results,
    qdrant: qdrantStatus,
    totalVectors: results.reduce((s, r) => s + r.vectors, 0),
    staleCount: results.filter(r => r.stale).length,
    timestamp: new Date().toISOString(),
  };
}

// ─── PL-002: scan_attack_surface (Stage 1: recon) ───────────────────────────

export function scanAttackSurface(rootDir = process.cwd()) {
  const findings = [];

  // 1. Check for exposed ports in config files
  const portPatterns = safeExec('grep -rn "PORT\\|listen\\|:3000\\|:8080\\|:5432" src/ configs/ --include="*.js" --include="*.ts" --include="*.json" 2>/dev/null | wc -l', rootDir);
  findings.push({ check: 'port_exposure_refs', count: parseInt(portPatterns.stdout) || 0 });

  // 2. Check for hardcoded secrets patterns
  const secretPatterns = safeExec('grep -rn "sk-\\|AIza\\|ghp_\\|gho_\\|AKIA" src/ services/ --include="*.ts" --include="*.js" 2>/dev/null | wc -l', rootDir);
  findings.push({ check: 'hardcoded_secrets', count: parseInt(secretPatterns.stdout) || 0, critical: (parseInt(secretPatterns.stdout) || 0) > 0 });

  // 3. Check for wildcard CORS
  const corsWild = safeExec('grep -rn "Access-Control-Allow-Origin.*\\*" src/ services/ --include="*.js" --include="*.ts" 2>/dev/null | wc -l', rootDir);
  findings.push({ check: 'cors_wildcard', count: parseInt(corsWild.stdout) || 0, critical: (parseInt(corsWild.stdout) || 0) > 0 });

  // 4. Check for public .env files
  const envExposed = safeExec('git ls-files | grep -E "^\\.env" 2>/dev/null | wc -l', rootDir);
  findings.push({ check: 'env_in_git', count: parseInt(envExposed.stdout) || 0, critical: (parseInt(envExposed.stdout) || 0) > 0 });

  // 5. Check SSL on all production domains
  const domains = ['headysystems.com', 'headyapi.com', 'headyme.com'];
  for (const domain of domains) {
    const ssl = safeExec(`echo | openssl s_client -servername ${domain} -connect ${domain}:443 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null`, rootDir);
    if (ssl.success) {
      const match = ssl.stdout.match(/notAfter=(.+)/);
      const expiry = match ? new Date(match[1]) : null;
      const daysLeft = expiry ? Math.round((expiry.getTime() - Date.now()) / 86400000) : -1;
      findings.push({ check: `ssl_${domain}`, daysLeft, critical: daysLeft < 14 });
    } else {
      findings.push({ check: `ssl_${domain}`, daysLeft: -1, critical: true });
    }
  }

  return {
    stage: 1,
    task: 'scan_attack_surface',
    findings,
    criticalCount: findings.filter(f => f.critical).length,
    timestamp: new Date().toISOString(),
  };
}

// ─── PL-003: scan_cost_trajectory (Stage 1: recon) ──────────────────────────

export function scanCostTrajectory(rootDir = process.cwd()) {
  // Check Cloud Run service count and revision ages
  const services = safeExec('gcloud run services list --project=gen-lang-client-0920560496 --format="value(metadata.name)" 2>/dev/null', rootDir);
  const serviceList = services.stdout.split('\n').filter(Boolean);

  // Check node_modules size (dependency cost)
  const nmSize = safeExec('du -sb node_modules/ 2>/dev/null | cut -f1', rootDir);
  const nmMB = Math.round((parseInt(nmSize.stdout) || 0) / 1024 / 1024);

  // Check git repo size
  const gitSize = safeExec("git count-objects -v 2>/dev/null | grep size-pack | awk '{print $2}'", rootDir);
  const gitMB = Math.round((parseInt(gitSize.stdout) || 0) / 1024);

  // Check for API key env vars (indicates provider costs)
  const apiKeys = safeExec('grep -c "API_KEY\\|SECRET_KEY" .env 2>/dev/null', rootDir);

  return {
    stage: 1,
    task: 'scan_cost_trajectory',
    cloudRunServices: serviceList.length,
    nodeModulesMB: nmMB,
    gitRepoMB: gitMB,
    apiProviders: parseInt(apiKeys.stdout) || 0,
    costAlerts: nmMB > 1000 ? ['node_modules exceeds 1GB'] : [],
    timestamp: new Date().toISOString(),
  };
}

// ─── PL-007: setup_sandbox_environments (Stage 6: trial-and-error) ──────────

export async function setupSandbox(taskId, config = {}) {
  const sandboxId = `sandbox-${taskId}-${Date.now()}`;
  const sandboxDir = join('/tmp', 'heady-sandboxes', sandboxId);

  // Create isolated directory structure
  const { success } = safeExec(`mkdir -p ${sandboxDir}/{src,configs,data}`, process.cwd());

  if (!success) {
    return { sandboxId, status: 'FAILED', reason: 'Could not create directory' };
  }

  // Copy minimal config files for isolated execution
  const configFiles = ['package.json', 'tsconfig.json'];
  for (const f of configFiles) {
    const src = join(process.cwd(), f);
    if (existsSync(src)) {
      safeExec(`cp ${src} ${sandboxDir}/`, process.cwd());
    }
  }

  return {
    stage: 6,
    task: 'setup_sandbox_environments',
    sandboxId,
    path: sandboxDir,
    status: 'READY',
    isolationLevel: config.docker ? 'CONTAINER' : 'DIRECTORY',
    createdAt: new Date().toISOString(),
    ttlMs: config.ttlMs || 300000, // 5 min default
  };
}

// ─── PL-008: cleanup_sandboxes (Stage 6: trial-and-error) ───────────────────

export function cleanupSandbox(sandboxId) {
  const sandboxDir = join('/tmp', 'heady-sandboxes', sandboxId);

  if (existsSync(sandboxDir)) {
    safeExec(`rm -rf ${sandboxDir}`, process.cwd());
    return { sandboxId, status: 'CLEANED', removedAt: new Date().toISOString() };
  }

  return { sandboxId, status: 'NOT_FOUND' };
}

export function cleanupAllSandboxes() {
  const baseDir = join('/tmp', 'heady-sandboxes');
  if (!existsSync(baseDir)) return { cleaned: 0 };

  const dirs = readdirSync(baseDir);
  let cleaned = 0;
  for (const d of dirs) {
    const full = join(baseDir, d);
    const age = Date.now() - statSync(full).mtimeMs;
    if (age > 300000) { // Older than 5 minutes
      safeExec(`rm -rf ${full}`, process.cwd());
      cleaned++;
    }
  }
  return { cleaned, timestamp: new Date().toISOString() };
}

export default {
  scanVectorStorage,
  scanAttackSurface,
  scanCostTrajectory,
  setupSandbox,
  cleanupSandbox,
  cleanupAllSandboxes,
};
