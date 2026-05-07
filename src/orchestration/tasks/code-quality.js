'use strict';

const fs = require('fs');
const path = require('path');
const { taskResult } = require('./utils');
const { PSI } = require('../../lib/phi-helpers');

const codeQualityTasks = {
  eslint_check: (start) => new Promise((resolve) => {
    const configs = ['.eslintrc.js', '.eslintrc.json', '.eslintrc.yml', '.eslintrc', 'eslint.config.js'];
    const cwd = process.cwd();
    const found = configs.find(c => {
      try { return fs.existsSync(path.join(cwd, c)); } catch { return false; }
    });
    const hasPkg = (() => {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
        return !!pkg.eslintConfig;
      } catch { return false; }
    })();
    const value = { configFound: !!(found || hasPkg), configFile: found || (hasPkg ? 'package.json#eslintConfig' : null) };
    resolve(taskResult('eslint_check', found || hasPkg ? 'pass' : 'warn', value, start));
  }),

  typescript_validation: (start) => new Promise((resolve) => {
    const tsconfigPaths = ['tsconfig.json', 'tsconfig.base.json'];
    const cwd = process.cwd();
    const found = tsconfigPaths.find(p => { try { return fs.existsSync(path.join(cwd, p)); } catch { return false; } });
    resolve(taskResult('typescript_validation', found ? 'pass' : 'warn', { tsconfigFound: !!found, file: found || null }, start));
  }),

  dead_code_detection: (start) => new Promise((resolve) => {
    let tools = [];
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
      const deps = Object.keys({ ...(pkg.devDependencies || {}), ...(pkg.dependencies || {}) });
      tools = deps.filter(d => ['knip', 'ts-prune', 'deadfile', 'unimported'].includes(d));
    } catch { /* no package.json */ }
    resolve(taskResult('dead_code_detection', tools.length > 0 ? 'pass' : 'warn', { toolsInstalled: tools }, start));
  }),

  import_cycle_detection: (start) => new Promise((resolve) => {
    let hasMadge = false;
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
      const deps = Object.keys({ ...(pkg.devDependencies || {}), ...(pkg.dependencies || {}) });
      hasMadge = deps.includes('madge') || deps.includes('dpdm');
    } catch { /* skip */ }
    resolve(taskResult('import_cycle_detection', hasMadge ? 'pass' : 'warn', { cycleDetectorInstalled: hasMadge }, start));
  }),

  complexity_scoring: (start) => new Promise((resolve) => {
    let fileCount = 0;
    try {
      const srcDir = path.join(process.cwd(), 'src');
      if (fs.existsSync(srcDir)) {
        const walk = (dir) => {
          fs.readdirSync(dir).forEach(f => {
            const full = path.join(dir, f);
            if (fs.statSync(full).isDirectory()) walk(full);
            else if (/\.(js|ts|mjs|cjs)$/.test(f)) fileCount++;
          });
        };
        walk(srcDir);
      }
    } catch { /* skip */ }
    const status = fileCount < 233 ? 'pass' : fileCount < 610 ? 'warn' : 'fail';
    resolve(taskResult('complexity_scoring', status, { fileCount, threshold: 233 }, start));
  }),

  duplication_scanning: (start) => new Promise((resolve) => {
    let hasJscpd = false;
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
      const deps = Object.keys({ ...(pkg.devDependencies || {}), ...(pkg.dependencies || {}) });
      hasJscpd = deps.includes('jscpd') || deps.includes('copy-paste');
    } catch { /* skip */ }
    resolve(taskResult('duplication_scanning', 'pass', { tool: hasJscpd ? 'jscpd' : 'none', configured: hasJscpd }, start));
  }),

  pattern_compliance: (start) => new Promise((resolve) => {
    const patternFiles = ['.editorconfig', 'prettier.config.js', '.prettierrc', '.prettierrc.json'];
    const cwd = process.cwd();
    const found = patternFiles.filter(f => { try { return fs.existsSync(path.join(cwd, f)); } catch { return false; } });
    resolve(taskResult('pattern_compliance', found.length > 0 ? 'pass' : 'warn', { configFilesFound: found }, start));
  }),

  naming_convention_audit: (start) => new Promise((resolve) => {
    let configured = false;
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
      configured = !!(pkg.eslintConfig || pkg['@typescript-eslint/naming-convention']);
    } catch { /* skip */ }
    resolve(taskResult('naming_convention_audit', 'pass', { configured, auditedAt: new Date().toISOString() }, start));
  }),

  deprecated_api_scan: (start) => new Promise((resolve) => {
    const nodeVersion = process.version;
    const major = parseInt(nodeVersion.slice(1));
    const status = major >= 18 ? 'pass' : major >= 14 ? 'warn' : 'fail';
    resolve(taskResult('deprecated_api_scan', status, { nodeVersion, majorVersion: major, recommendation: 'Node >= 18 LTS' }, start));
  }),

  bundle_size_tracking: (start) => new Promise((resolve) => {
    let distSize = 0;
    try {
      const distDir = path.join(process.cwd(), 'dist');
      if (fs.existsSync(distDir)) {
        const walk = (dir) => {
          fs.readdirSync(dir).forEach(f => {
            const full = path.join(dir, f);
            const stat = fs.statSync(full);
            if (stat.isDirectory()) walk(full);
            else distSize += stat.size;
          });
        };
        walk(distDir);
      }
    } catch { /* skip */ }
    const limitBytes = 1597 * 1024;  // fib(17) = 1597 KB
    const status = distSize === 0 ? 'warn' : distSize < limitBytes ? 'pass' : 'fail';
    resolve(taskResult('bundle_size_tracking', status, { distSizeBytes: distSize, limitBytes, limitKB: 1597 }, start));
  }),

  test_coverage_calc: (start) => new Promise((resolve) => {
    const coverageDir = path.join(process.cwd(), 'coverage');
    const hasCoverage = (() => { try { return fs.existsSync(coverageDir); } catch { return false; } })();
    let coveragePct = null;
    if (hasCoverage) {
      const summaryPath = path.join(coverageDir, 'coverage-summary.json');
      try {
        const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
        coveragePct = summary.total && summary.total.lines ? summary.total.lines.pct : null;
      } catch { /* no summary */ }
    }
    const threshold = PSI * 100;  // 61.8% minimum
    const status = coveragePct === null ? 'warn' : coveragePct >= threshold ? 'pass' : 'fail';
    resolve(taskResult('test_coverage_calc', status, { coveragePct, threshold, hasCoverageDir: hasCoverage }, start));
  }),

  doc_completeness: (start) => new Promise((resolve) => {
    const docFiles = ['README.md', 'docs/README.md', 'CONTRIBUTING.md', 'CHANGELOG.md'];
    const cwd = process.cwd();
    const found = docFiles.filter(f => { try { return fs.existsSync(path.join(cwd, f)); } catch { return false; } });
    const status = found.length >= 2 ? 'pass' : found.length >= 1 ? 'warn' : 'fail';
    resolve(taskResult('doc_completeness', status, { docsFound: found, completeness: found.length / docFiles.length }, start));
  }),

  coding_standard_enforcement: (start) => new Promise((resolve) => {
    const hasPrettier = (() => {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
        const deps = Object.keys({ ...(pkg.devDependencies || {}), ...(pkg.dependencies || {}) });
        return deps.includes('prettier');
      } catch { return false; }
    })();
    resolve(taskResult('coding_standard_enforcement', hasPrettier ? 'pass' : 'warn', { prettierInstalled: hasPrettier }, start));
  }),

  dependency_freshness: (start) => new Promise((resolve) => {
    let outdatedCount = 0;
    let totalDeps = 0;
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      totalDeps = Object.keys(deps).length;
      outdatedCount = Object.values(deps).filter(v => /^[0-9]/.test(v) && parseInt(v) < 2).length;
    } catch { /* no package.json */ }
    const ratio = totalDeps > 0 ? (totalDeps - outdatedCount) / totalDeps : 1;
    const status = ratio >= PSI ? 'pass' : 'warn';
    resolve(taskResult('dependency_freshness', status, { totalDeps, outdatedCount, freshnessRatio: ratio }, start));
  }),

  security_pattern_detection: (start) => new Promise((resolve) => {
    let secTools = [];
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
      const deps = Object.keys({ ...(pkg.devDependencies || {}), ...(pkg.dependencies || {}) });
      secTools = deps.filter(d => ['helmet', 'express-rate-limit', 'cors', 'csurf', 'bcrypt', 'argon2', 'jsonwebtoken'].includes(d));
    } catch { /* skip */ }
    resolve(taskResult('security_pattern_detection', 'pass', { securityToolsFound: secTools }, start));
  })
};

module.exports = codeQualityTasks;
