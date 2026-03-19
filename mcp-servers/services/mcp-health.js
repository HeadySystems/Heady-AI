/**
 * Heady MCP — Health & Audit Service
 * Handles: healthPing, envAudit, depsScan, configValidate, secretsScan,
 *          codeStats, cloudrunStatus, docsFreshness, quickFix, costReport
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const yaml = require('js-yaml');

const HEADY_ROOT = path.resolve(__dirname, '..', '..');
const CONFIGS_DIR = path.join(HEADY_ROOT, 'configs');

class McpHealth {
  async healthPing(timeout) {
    const catalogPath = path.join(CONFIGS_DIR, 'service-catalog.yaml');
    if (!fs.existsSync(catalogPath)) throw new Error('service-catalog.yaml not found');
    const catalog = yaml.load(fs.readFileSync(catalogPath, 'utf8'));
    if (!catalog?.services) throw new Error('No services in catalog');

    const to = timeout || 5000;
    const results = [];
    for (const svc of catalog.services) {
      if (!svc.endpoint || svc.endpoint === 'N/A') {
        results.push({ name: svc.name, status: 'no-endpoint', endpoint: 'N/A' });
        continue;
      }
      try {
        const url = new URL(svc.endpoint.startsWith('http') ? svc.endpoint : `http://${svc.endpoint}`);
        const start = Date.now();
        const result = await new Promise((resolve) => {
          const req = http.get({ hostname: url.hostname, port: url.port || 80, path: url.pathname || '/', timeout: to }, (res) => {
            resolve({ status: 'up', code: res.statusCode, latency: Date.now() - start });
          });
          req.on('error', () => resolve({ status: 'down', latency: Date.now() - start }));
          req.on('timeout', () => { req.destroy(); resolve({ status: 'timeout', latency: to }); });
        });
        results.push({ name: svc.name, endpoint: svc.endpoint, ...result });
      } catch (e) {
        results.push({ name: svc.name, endpoint: svc.endpoint, status: 'error', error: e.message });
      }
    }
    const up = results.filter(r => r.status === 'up').length;
    const down = results.filter(r => r.status === 'down' || r.status === 'timeout').length;
    const lines = results.map(r => {
      const icon = r.status === 'up' ? '🟢' : r.status === 'no-endpoint' ? '⚪' : '🔴';
      return `${icon} ${r.name}: ${r.status}${r.code ? ` (${r.code})` : ''}${r.latency ? ` ${r.latency}ms` : ''} — ${r.endpoint}`;
    });
    return { content: [{ type: 'text', text: `# Service Health\n\n🟢 Up: ${up} | 🔴 Down: ${down} | Total: ${results.length}\n\n${lines.join('\n')}` }] };
  }

  async envAudit() {
    const envPath = path.join(HEADY_ROOT, '.env');
    if (!fs.existsSync(envPath)) throw new Error('.env not found');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars = {};
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        envVars[trimmed.substring(0, eqIdx).trim()] = trimmed.substring(eqIdx + 1).trim();
      }
    }

    const referencedVars = new Set();
    const scanForEnv = (dir, depth = 0) => {
      if (depth > 3) return;
      try {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'data') continue;
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) { scanForEnv(fullPath, depth + 1); continue; }
          if (!/\.(js|py|yaml|yml)$/.test(entry.name)) continue;
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            (content.match(/process\.env\.(\w+)/g) || []).forEach(m => referencedVars.add(m.replace('process.env.', '')));
            (content.match(/os\.environ(?:\.get)?\(['"](\w+)['"]\)/g) || []).forEach(m => { const k = m.match(/['"](\w+)['"]/); if (k) referencedVars.add(k[1]); });
          } catch (e) { /* skip */ }
        }
      } catch (e) { /* skip */ }
    };
    scanForEnv(HEADY_ROOT);

    const empty = Object.entries(envVars).filter(([, v]) => !v).map(([k]) => k);
    const unused = Object.keys(envVars).filter(k => !referencedVars.has(k));
    const missing = [...referencedVars].filter(v => !(v in envVars));
    const sensitive = Object.keys(envVars).filter(k => /KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL/i.test(k));
    const hasValues = sensitive.filter(k => envVars[k] && envVars[k].length > 3);

    return { content: [{ type: 'text', text: [
      `# Environment Audit`, `\nTotal vars in .env: ${Object.keys(envVars).length}`, `Referenced in code: ${referencedVars.size}`,
      `\n## Empty Values (${empty.length})`, empty.map(k => `• ${k}`).join('\n') || 'None',
      `\n## Missing from .env (${missing.length})`, missing.map(k => `• ${k}`).join('\n') || 'None',
      `\n## Potentially Unused (${unused.length})`, unused.slice(0, 20).map(k => `• ${k}`).join('\n') || 'None',
      `\n## Sensitive Keys (${sensitive.length})`, sensitive.map(k => `• ${k}: ${envVars[k] ? '✓ has value' : '✗ EMPTY'}`).join('\n') || 'None',
      hasValues.length > 0 ? `\n⚠️ ${hasValues.length} sensitive key(s) have values — ensure .env is in .gitignore!` : ''
    ].join('\n') }] };
  }

  async depsScan() {
    const pkgPath = path.join(HEADY_ROOT, 'package.json');
    if (!fs.existsSync(pkgPath)) throw new Error('package.json not found');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const deps = { ...pkg.dependencies };
    const devDeps = { ...pkg.devDependencies };
    const all = { ...deps, ...devDeps };

    const issues = [];
    const gitDeps = Object.entries(all).filter(([, v]) => v.includes('github') || v.includes('git+'));
    const fileDeps = Object.entries(all).filter(([, v]) => v.startsWith('file:'));
    const wildcardDeps = Object.entries(all).filter(([, v]) => v === '*' || v === 'latest');
    const betaDeps = Object.entries(all).filter(([, v]) => /alpha|beta|rc|canary/i.test(v));

    if (gitDeps.length) issues.push(`⚠️ Git dependencies (${gitDeps.length}): ${gitDeps.map(([k]) => k).join(', ')}`);
    if (fileDeps.length) issues.push(`⚠️ File dependencies (${fileDeps.length}): ${fileDeps.map(([k]) => k).join(', ')}`);
    if (wildcardDeps.length) issues.push(`🔴 Wildcard versions (${wildcardDeps.length}): ${wildcardDeps.map(([k]) => k).join(', ')}`);
    if (betaDeps.length) issues.push(`⚠️ Pre-release (${betaDeps.length}): ${betaDeps.map(([k, v]) => `${k}@${v}`).join(', ')}`);

    const nmExists = fs.existsSync(path.join(HEADY_ROOT, 'node_modules'));
    const lockExists = fs.existsSync(path.join(HEADY_ROOT, 'package-lock.json'));

    const workspacePkgs = [];
    const packagesDir = path.join(HEADY_ROOT, 'packages');
    if (fs.existsSync(packagesDir)) {
      for (const d of fs.readdirSync(packagesDir, { withFileTypes: true })) {
        if (d.isDirectory()) {
          const wPkg = path.join(packagesDir, d.name, 'package.json');
          if (fs.existsSync(wPkg)) {
            const wp = JSON.parse(fs.readFileSync(wPkg, 'utf8'));
            workspacePkgs.push(`• ${wp.name || d.name}@${wp.version || '0.0.0'}`);
          }
        }
      }
    }

    return { content: [{ type: 'text', text: [
      `# Dependency Report`, `\nDependencies: ${Object.keys(deps).length}`, `Dev Dependencies: ${Object.keys(devDeps).length}`,
      `node_modules: ${nmExists ? '✓ present' : '✗ missing'}`, `package-lock.json: ${lockExists ? '✓ present' : '✗ MISSING'}`,
      issues.length > 0 ? `\n## Issues (${issues.length})\n${issues.join('\n')}` : '\n✅ No dependency issues found',
      workspacePkgs.length > 0 ? `\n## Workspace Packages (${workspacePkgs.length})\n${workspacePkgs.join('\n')}` : ''
    ].join('\n') }] };
  }

  async configValidate() {
    const issues = [];
    const warnings = [];
    const loadYaml = (name) => {
      try { return yaml.load(fs.readFileSync(path.join(CONFIGS_DIR, name), 'utf8')); }
      catch (e) { issues.push(`Cannot load ${name}: ${e.message}`); return null; }
    };

    const pipeline = loadYaml('hcfullpipeline.yaml');
    const services = loadYaml('service-catalog.yaml');
    const resources = loadYaml('resource-policies.yaml');
    const governance = loadYaml('governance-policies.yaml');
    const concepts = loadYaml('concepts-index.yaml');

    if (pipeline && services) {
      const serviceNames = new Set((services.services || []).map(s => s.name));
      const stages = pipeline.stages || pipeline.pipeline?.stages || [];
      if (Array.isArray(stages)) {
        for (const stage of stages) {
          const name = typeof stage === 'string' ? stage : stage.name || stage.id;
          if (name && !serviceNames.has(name)) warnings.push(`Pipeline stage '${name}' not in service catalog`);
        }
      }
    }
    if (services) {
      const svcList = services.services || [];
      const noEndpoint = svcList.filter(s => !s.endpoint || s.endpoint === 'N/A');
      if (noEndpoint.length) warnings.push(`${noEndpoint.length} services without endpoints: ${noEndpoint.map(s => s.name).join(', ')}`);
      const noCrit = svcList.filter(s => !s.criticality);
      if (noCrit.length) warnings.push(`${noCrit.length} services without criticality level`);
    }
    if (resources) {
      if (!resources.budgets && !resources.cost_budgets) warnings.push('resource-policies.yaml: no budget definitions found');
      if (!resources.rate_limits && !resources.concurrency) warnings.push('resource-policies.yaml: no rate limits or concurrency defined');
    }
    if (!governance) issues.push('governance-policies.yaml: missing or unparseable');
    if (!concepts) warnings.push('concepts-index.yaml: missing — cannot track pattern implementation');

    for (const rc of ['hcfullpipeline.yaml', 'service-catalog.yaml', 'resource-policies.yaml', 'governance-policies.yaml']) {
      if (!fs.existsSync(path.join(CONFIGS_DIR, rc))) issues.push(`Required config missing: ${rc}`);
    }

    return { content: [{ type: 'text', text: [
      `# Config Validation`, `\n🔴 Issues: ${issues.length} | ⚠️ Warnings: ${warnings.length}`,
      issues.length > 0 ? `\n## Issues\n${issues.map(i => `🔴 ${i}`).join('\n')}` : '',
      warnings.length > 0 ? `\n## Warnings\n${warnings.map(w => `⚠️ ${w}`).join('\n')}` : '',
      issues.length === 0 && warnings.length === 0 ? '\n✅ All configs valid!' : ''
    ].join('\n') }] };
  }

  async secretsScan() {
    const patterns = [
      { name: 'API Key', regex: /(?:api[_-]?key|apikey)\s*[:=]\s*['"]?([A-Za-z0-9_\-]{20,})['"]?/gi },
      { name: 'Secret', regex: /(?:secret|private[_-]?key)\s*[:=]\s*['"]?([A-Za-z0-9_\-]{20,})['"]?/gi },
      { name: 'Token', regex: /(?:token|bearer)\s*[:=]\s*['"]?([A-Za-z0-9_\-\.]{20,})['"]?/gi },
      { name: 'Password', regex: /(?:password|passwd|pwd)\s*[:=]\s*['"]?([^\s'"]{8,})['"]?/gi },
      { name: 'AWS Key', regex: /AKIA[0-9A-Z]{16}/g },
      { name: 'Private Key', regex: /-----BEGIN (?:RSA )?PRIVATE KEY-----/g },
    ];
    const findings = [];
    const scanDir = (dir, depth = 0) => {
      if (depth > 3) return;
      try {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'data' || entry.name === '.env') continue;
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) { scanDir(fullPath, depth + 1); continue; }
          if (!/\.(js|py|yaml|yml|json|md|ps1|sh|env\.example)$/.test(entry.name)) continue;
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            for (const p of patterns) {
              if (p.regex.test(content)) findings.push({ file: path.relative(HEADY_ROOT, fullPath), type: p.name });
              p.regex.lastIndex = 0;
            }
          } catch (e) { /* skip */ }
        }
      } catch (e) { /* skip */ }
    };
    scanDir(HEADY_ROOT);
    const lines = findings.map(f => `🔑 ${f.type} in ${f.file}`);
    return { content: [{ type: 'text', text: findings.length > 0
      ? `# Secrets Scan: ${findings.length} potential exposure(s)\n\n${lines.join('\n')}\n\n⚠️ Review each finding — some may be config templates.`
      : '✅ No hardcoded secrets found!' }] };
  }

  async codeStats() {
    const stats = { byExt: {}, totalFiles: 0, totalLines: 0, largest: [] };
    const scanDir = (dir, depth = 0) => {
      if (depth > 4) return;
      try {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'data' || entry.name === 'venv') continue;
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) { scanDir(fullPath, depth + 1); continue; }
          const ext = path.extname(entry.name) || 'no-ext';
          if (!/\.(js|py|yaml|yml|json|md|ps1|sh|jsx|tsx|ts|css|html|sql)$/.test(entry.name)) continue;
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            const lineCount = content.split('\n').length;
            stats.totalFiles++;
            stats.totalLines += lineCount;
            stats.byExt[ext] = stats.byExt[ext] || { files: 0, lines: 0 };
            stats.byExt[ext].files++;
            stats.byExt[ext].lines += lineCount;
            stats.largest.push({ file: path.relative(HEADY_ROOT, fullPath), lines: lineCount });
          } catch (e) { /* skip */ }
        }
      } catch (e) { /* skip */ }
    };
    scanDir(HEADY_ROOT);
    stats.largest.sort((a, b) => b.lines - a.lines);
    const extLines = Object.entries(stats.byExt).sort(([, a], [, b]) => b.lines - a.lines)
      .map(([ext, s]) => `• ${ext}: ${s.files} files, ${s.lines.toLocaleString()} lines`);
    const top10 = stats.largest.slice(0, 10).map((f, i) => `${i + 1}. ${f.file} (${f.lines.toLocaleString()} lines)`);
    return { content: [{ type: 'text', text: `# Code Statistics\n\nTotal: ${stats.totalFiles.toLocaleString()} files, ${stats.totalLines.toLocaleString()} lines\n\n## By Language\n${extLines.join('\n')}\n\n## Largest Files\n${top10.join('\n')}` }] };
  }

  async cloudrunStatus() {
    const discoveryPath = path.join(CONFIGS_DIR, 'service-discovery.yaml');
    if (!fs.existsSync(discoveryPath)) return { content: [{ type: 'text', text: '⚠️ service-discovery.yaml not found' }] };
    const discovery = yaml.load(fs.readFileSync(discoveryPath, 'utf8'));
    const services = Object.entries(discovery.services || {}).map(([name, s]) => `• ${name} — ${s.host || 'N/A'}:${s.port || 'N/A'}`);
    return { content: [{ type: 'text', text: `# Cloud Run Deployment\n\n## Services (${services.length})\n${services.join('\n')}\n\nDeployment platform: GCP Cloud Run\nDeploy method: git push → Cloud Build → Cloud Run` }] };
  }

  async docsFreshness() {
    const docsDir = path.join(HEADY_ROOT, 'docs');
    const ownersPath = path.join(docsDir, 'DOC_OWNERS.yaml');
    const results = [];
    if (fs.existsSync(docsDir)) {
      for (const f of fs.readdirSync(docsDir, { withFileTypes: true }).filter(e => e.isFile() && /\.(md|yaml|yml|json)$/.test(e.name))) {
        const stat = fs.statSync(path.join(docsDir, f.name));
        const daysSince = Math.floor((Date.now() - stat.mtimeMs) / 86400000);
        results.push({ file: f.name, days: daysSince, stale: daysSince > 60, size: stat.size });
      }
    }
    let owners = null;
    if (fs.existsSync(ownersPath)) owners = yaml.load(fs.readFileSync(ownersPath, 'utf8'));
    const stale = results.filter(r => r.stale);
    const lines = results.map(r => `${r.stale ? '🔴' : '🟢'} ${r.file} — ${r.days}d ago (${(r.size / 1024).toFixed(1)}KB)`);
    return { content: [{ type: 'text', text: `# Documentation Freshness\n\nTotal: ${results.length} docs | Stale (>60d): ${stale.length}\n\n${lines.join('\n')}\n\n${owners ? `DOC_OWNERS: ✓ (${Object.keys(owners).length} entries)` : '⚠️ DOC_OWNERS.yaml not found'}` }] };
  }

  async quickFix(fix, dryRun) {
    const fixes = [];
    const scanDir = (dir, depth = 0) => {
      if (depth > 3) return;
      try {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'data') continue;
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) { scanDir(fullPath, depth + 1); continue; }
          if (!/\.(js|py)$/.test(entry.name)) continue;
          try {
            let content = fs.readFileSync(fullPath, 'utf8');
            const relPath = path.relative(HEADY_ROOT, fullPath);
            let changed = false;
            if (fix === 'console-logs' || fix === 'all') {
              const count = (content.match(/console\.log\(/g) || []).length;
              if (count > 0) { fixes.push(`${relPath}: ${count} console.log(s)`); if (!dryRun) { content = content.replace(/^\s*console\.log\(.*\);\s*\n?/gm, ''); changed = true; } }
            }
            if (fix === 'whitespace' || fix === 'all') {
              const trailing = (content.match(/[ \t]+$/gm) || []).length;
              if (trailing > 0) { fixes.push(`${relPath}: ${trailing} trailing whitespace`); if (!dryRun) { content = content.replace(/[ \t]+$/gm, ''); changed = true; } }
            }
            if (fix === 'line-endings' || fix === 'all') {
              if (content.includes('\r\n')) { fixes.push(`${relPath}: CRLF line endings`); if (!dryRun) { content = content.replace(/\r\n/g, '\n'); changed = true; } }
            }
            if (changed && !dryRun) fs.writeFileSync(fullPath, content);
          } catch (e) { /* skip */ }
        }
      } catch (e) { /* skip */ }
    };
    scanDir(HEADY_ROOT);
    return { content: [{ type: 'text', text: `# Quick Fix: ${fix} (${dryRun ? 'DRY RUN' : 'APPLIED'})\n\nFound ${fixes.length} issue(s):\n${fixes.join('\n') || 'None!'}` }] };
  }

  async costReport() {
    const resourcesPath = path.join(CONFIGS_DIR, 'resource-policies.yaml');
    if (!fs.existsSync(resourcesPath)) return { content: [{ type: 'text', text: '⚠️ resource-policies.yaml not found' }] };
    const resources = yaml.load(fs.readFileSync(resourcesPath, 'utf8'));
    return { content: [{ type: 'text', text: `# Cost & Resource Report\n\n${JSON.stringify(resources, null, 2).substring(0, 5000)}` }] };
  }
}

module.exports = McpHealth;
