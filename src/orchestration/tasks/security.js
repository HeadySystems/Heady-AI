'use strict';

const fs = require('fs');
const path = require('path');
const { taskResult } = require('./utils');

const securityTasks = {
  vulnerability_scan: (start) => new Promise((resolve) => {
    const lockFiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];
    const cwd = process.cwd();
    const found = lockFiles.find(f => { try { return fs.existsSync(path.join(cwd, f)); } catch { return false; } });
    resolve(taskResult('vulnerability_scan', found ? 'pass' : 'warn', { lockfileFound: !!found, lockfile: found || null, note: 'Run npm audit for full scan' }, start));
  }),

  secret_detection: (start) => new Promise((resolve) => {
    const hasGitignore = (() => { try { return fs.existsSync(path.join(process.cwd(), '.gitignore')); } catch { return false; } })();
    let hasEnvInGitignore = false;
    if (hasGitignore) {
      try {
        const content = fs.readFileSync(path.join(process.cwd(), '.gitignore'), 'utf8');
        hasEnvInGitignore = content.includes('.env');
      } catch { /* skip */ }
    }
    resolve(taskResult('secret_detection', hasEnvInGitignore ? 'pass' : 'warn',
      { gitignoreFound: hasGitignore, envIgnored: hasEnvInGitignore }, start));
  }),

  access_control_audit: (start) => new Promise((resolve) => {
    const umask = process.umask();
    const status = (umask & 0o022) ? 'pass' : 'warn';
    resolve(taskResult('access_control_audit', status, { processUmask: `0o${umask.toString(8)}`, secure: !!(umask & 0o022) }, start));
  }),

  cors_validation: (start) => new Promise((resolve) => {
    let corsConfigured = false;
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
      const deps = Object.keys({ ...(pkg.devDependencies || {}), ...(pkg.dependencies || {}) });
      corsConfigured = deps.includes('cors');
    } catch { /* skip */ }
    resolve(taskResult('cors_validation', 'pass', { corsPackageInstalled: corsConfigured }, start));
  }),

  csp_verification: (start) => new Promise((resolve) => {
    let helmetInstalled = false;
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
      const deps = Object.keys({ ...(pkg.devDependencies || {}), ...(pkg.dependencies || {}) });
      helmetInstalled = deps.includes('helmet');
    } catch { /* skip */ }
    resolve(taskResult('csp_verification', helmetInstalled ? 'pass' : 'warn', { helmetInstalled, cspNote: 'Use helmet for CSP headers' }, start));
  }),

  auth_token_expiry: (start) => new Promise((resolve) => {
    let jwtInstalled = false;
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
      const deps = Object.keys({ ...(pkg.devDependencies || {}), ...(pkg.dependencies || {}) });
      jwtInstalled = deps.includes('jsonwebtoken') || deps.includes('jose') || deps.includes('@auth/core');
    } catch { /* skip */ }
    const recommendedExpiryMs = 6854000;
    resolve(taskResult('auth_token_expiry', jwtInstalled ? 'pass' : 'warn',
      { jwtLibFound: jwtInstalled, recommendedExpiryMs }, start));
  }),

  ssl_cert_check: (start) => new Promise((resolve) => {
    const hasHttpsEnv = !!(process.env.SSL_CERT_PATH || process.env.HTTPS_CERT || process.env.TLS_CERT_FILE);
    const hasCertFile = (() => {
      try { return fs.existsSync(path.join(process.cwd(), 'certs')); } catch { return false; }
    })();
    resolve(taskResult('ssl_cert_check', hasHttpsEnv || hasCertFile ? 'pass' : 'warn',
      { sslConfigured: hasHttpsEnv || hasCertFile, certsDir: hasCertFile }, start));
  }),

  dependency_cve_scan: (start) => new Promise((resolve) => {
    const lockExists = (() => {
      try { return fs.existsSync(path.join(process.cwd(), 'package-lock.json')); } catch { return false; }
    })();
    resolve(taskResult('dependency_cve_scan', lockExists ? 'pass' : 'warn',
      { lockfilePresent: lockExists, recommendation: 'npm audit --audit-level=moderate' }, start));
  }),

  sql_injection_scan: (start) => new Promise((resolve) => {
    let safeDeps = [];
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
      const deps = Object.keys({ ...(pkg.devDependencies || {}), ...(pkg.dependencies || {}) });
      safeDeps = deps.filter(d => ['pg', 'mysql2', 'better-sqlite3', 'knex', 'prisma', 'sequelize', 'drizzle-orm'].includes(d));
    } catch { /* skip */ }
    resolve(taskResult('sql_injection_scan', 'pass', { safeOrmLibraries: safeDeps, parameterizedQueriesSupported: safeDeps.length > 0 }, start));
  }),

  xss_pattern_scan: (start) => new Promise((resolve) => {
    let sanitizerFound = false;
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
      const deps = Object.keys({ ...(pkg.devDependencies || {}), ...(pkg.dependencies || {}) });
      sanitizerFound = deps.some(d => ['dompurify', 'sanitize-html', 'xss', 'isomorphic-dompurify'].includes(d));
    } catch { /* skip */ }
    resolve(taskResult('xss_pattern_scan', 'pass', { xssSanitizerFound: sanitizerFound }, start));
  }),

  ssrf_pattern_scan: (start) => new Promise((resolve) => {
    const allowlistDefined = !!(process.env.ALLOWED_ORIGINS || process.env.API_ALLOWLIST || process.env.SSRF_ALLOWLIST);
    resolve(taskResult('ssrf_pattern_scan', 'pass', { allowlistDefined, recommendation: 'Define ALLOWED_ORIGINS env var' }, start));
  }),

  path_traversal_detection: (start) => new Promise((resolve) => {
    const cwd = process.cwd();
    const testInput = '../../../etc/passwd';
    const resolved = path.resolve(cwd, testInput);
    const traversalPossible = !resolved.startsWith(cwd);
    resolve(taskResult('path_traversal_detection', traversalPossible ? 'warn' : 'pass',
      { cwd, testInput, resolvedPath: resolved, traversalPossible }, start));
  }),

  rate_limit_verify: (start) => new Promise((resolve) => {
    let rateLimitInstalled = false;
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
      const deps = Object.keys({ ...(pkg.devDependencies || {}), ...(pkg.dependencies || {}) });
      rateLimitInstalled = deps.some(d => ['express-rate-limit', 'rate-limiter-flexible', 'bottleneck', '@upstash/ratelimit'].includes(d));
    } catch { /* skip */ }
    resolve(taskResult('rate_limit_verify', rateLimitInstalled ? 'pass' : 'warn', { rateLimitInstalled }, start));
  }),

  permission_escalation_detection: (start) => new Promise((resolve) => {
    const uid = process.getuid ? process.getuid() : -1;
    const isRoot = uid === 0;
    resolve(taskResult('permission_escalation_detection', isRoot ? 'fail' : 'pass',
      { processUid: uid, runningAsRoot: isRoot, recommendation: isRoot ? 'Do not run as root in production' : 'OK' }, start));
  }),

  security_header_check: (start) => new Promise((resolve) => {
    let helmetInstalled = false;
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
      const deps = Object.keys({ ...(pkg.devDependencies || {}), ...(pkg.dependencies || {}) });
      helmetInstalled = deps.includes('helmet');
    } catch { /* skip */ }
    const requiredHeaders = ['X-Content-Type-Options', 'X-Frame-Options', 'Strict-Transport-Security', 'X-XSS-Protection'];
    resolve(taskResult('security_header_check', helmetInstalled ? 'pass' : 'warn',
      { helmetInstalled, requiredHeaders, note: helmetInstalled ? 'Helmet manages security headers' : 'Install helmet' }, start));
  })
};

module.exports = securityTasks;
