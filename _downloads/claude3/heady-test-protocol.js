#!/usr/bin/env node
/**
 * HEADY SYSTEM — Master Test Protocol
 * ═══════════════════════════════════════════════════════════════
 * This file defines and executes a comprehensive test suite for
 * every component of the Heady ecosystem. Each test produces a
 * structured result (PASS / FAIL / SKIP) with diagnostics.
 *
 * Run: node heady-test-protocol.js
 *
 * The protocol is designed to be run from ANY environment and
 * will gracefully skip tests for components that aren't reachable.
 * ═══════════════════════════════════════════════════════════════
 */

const https = require("https");
const http = require("http");
const { execSync } = require("child_process");
const fs = require("fs");

// ─── Test Infrastructure ───
const results = [];
const startTime = Date.now();

function log(symbol, category, name, detail) {
  const line = `${symbol} [${category}] ${name}: ${detail}`;
  console.log(line);
  results.push({ symbol, category, name, detail, timestamp: new Date().toISOString() });
}

function pass(cat, name, detail) { log("✅", cat, name, detail); }
function fail(cat, name, detail) { log("❌", cat, name, detail); }
function warn(cat, name, detail) { log("⚠️", cat, name, detail); }
function skip(cat, name, detail) { log("⏭️", cat, name, detail); }
function info(cat, name, detail) { log("ℹ️", cat, name, detail); }

// ─── HTTP request helper ───
function httpGet(url, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    const req = mod.get(url, { timeout: timeoutMs }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

// ─── Shell command helper ───
function shellCheck(cmd) {
  try {
    const out = execSync(cmd, { encoding: "utf8", timeout: 10000 }).trim();
    return { ok: true, output: out };
  } catch (e) {
    return { ok: false, output: e.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// TEST SUITE 1: MCP SERVER CONNECTIVITY
// ═══════════════════════════════════════════════════════════════
async function testMCPServer() {
  console.log("\n═══ TEST SUITE 1: MCP Server Connectivity ═══");

  // Test 1.1: DNS resolution
  const dns = shellCheck("nslookup manager.headysystems.com 2>/dev/null || dig manager.headysystems.com +short 2>/dev/null || echo 'DNS_FAIL'");
  if (dns.ok && !dns.output.includes("DNS_FAIL") && dns.output.length > 0) {
    pass("MCP", "DNS Resolution", `manager.headysystems.com resolves: ${dns.output.split("\n")[0]}`);
  } else {
    fail("MCP", "DNS Resolution", "manager.headysystems.com does not resolve. Check domain configuration.");
  }

  // Test 1.2: HTTPS connectivity
  try {
    const res = await httpGet("https://manager.headysystems.com", 10000);
    if (res.status >= 200 && res.status < 400) {
      pass("MCP", "HTTPS Connectivity", `Server responds with status ${res.status}`);
    } else {
      warn("MCP", "HTTPS Connectivity", `Server responds but with status ${res.status}`);
    }
  } catch (e) {
    fail("MCP", "HTTPS Connectivity", `Cannot reach server: ${e.message}`);
  }

  // Test 1.3: SSE endpoint
  try {
    const res = await httpGet("https://manager.headysystems.com/mcp/sse", 10000);
    if (res.status === 200 && (res.headers["content-type"] || "").includes("text/event-stream")) {
      pass("MCP", "SSE Endpoint", "MCP SSE endpoint responds with correct content-type");
    } else if (res.status === 200) {
      warn("MCP", "SSE Endpoint", `Responds 200 but content-type is: ${res.headers["content-type"]}`);
    } else {
      fail("MCP", "SSE Endpoint", `SSE endpoint returns status ${res.status}. Expected 200 with text/event-stream.`);
    }
  } catch (e) {
    fail("MCP", "SSE Endpoint", `SSE endpoint unreachable: ${e.message}`);
  }

  // Test 1.4: TLS Certificate
  try {
    const res = await httpGet("https://manager.headysystems.com", 5000);
    pass("MCP", "TLS Certificate", "TLS handshake succeeded (certificate valid or accepted)");
  } catch (e) {
    if (e.message.includes("certificate") || e.message.includes("SSL")) {
      fail("MCP", "TLS Certificate", `TLS error: ${e.message}. Check certificate expiry and chain.`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// TEST SUITE 2: SECURITY AUDIT
// ═══════════════════════════════════════════════════════════════
async function testSecurity() {
  console.log("\n═══ TEST SUITE 2: Security Audit ═══");

  // Test 2.1: Check for .env files in git (if git repo available)
  const gitCheck = shellCheck("git log --all --name-only 2>/dev/null | grep -E '\\.env' | head -5");
  if (gitCheck.ok && gitCheck.output.length > 0) {
    fail("SECURITY", "Credential Exposure", `Found .env files in git history: ${gitCheck.output}`);
  } else if (gitCheck.ok) {
    pass("SECURITY", "Credential Exposure", "No .env files found in git history");
  } else {
    skip("SECURITY", "Credential Exposure", "Not in a git repository; cannot check history");
  }

  // Test 2.2: Check .gitignore exists and covers critical patterns
  if (fs.existsSync(".gitignore")) {
    const gitignore = fs.readFileSync(".gitignore", "utf8");
    const required = [".env", "*.pid", "*.bak", "node_modules", "__pycache__"];
    const missing = required.filter(p => !gitignore.includes(p));
    if (missing.length === 0) {
      pass("SECURITY", ".gitignore Coverage", "All critical patterns are covered");
    } else {
      fail("SECURITY", ".gitignore Coverage", `Missing patterns: ${missing.join(", ")}`);
    }
  } else {
    fail("SECURITY", ".gitignore Exists", "No .gitignore file found! Critical files may be tracked.");
  }

  // Test 2.3: Check for hardcoded credentials in JS files
  const credCheck = shellCheck("grep -rn 'password\\|secret\\|api_key\\|apikey\\|token' --include='*.js' --include='*.ts' --include='*.py' . 2>/dev/null | grep -iv 'node_modules' | grep -iv 'test' | head -10");
  if (credCheck.ok && credCheck.output.length > 10) {
    warn("SECURITY", "Hardcoded Credentials", `Potential credential references found in source code (review manually):\n${credCheck.output.substring(0, 200)}`);
  } else {
    pass("SECURITY", "Hardcoded Credentials", "No obvious credential patterns in source files");
  }

  // Test 2.4: Check for console.log in production files
  const consoleCheck = shellCheck("grep -rn 'console\\.log' --include='*.js' --include='*.ts' . 2>/dev/null | grep -iv 'node_modules' | grep -iv 'test' | wc -l");
  if (consoleCheck.ok) {
    const count = parseInt(consoleCheck.output, 10);
    if (count > 20) {
      fail("SECURITY", "console.log in Production", `Found ${count} console.log statements. Replace with structured logging (Pino).`);
    } else if (count > 0) {
      warn("SECURITY", "console.log in Production", `Found ${count} console.log statements. Should use structured logging.`);
    } else {
      pass("SECURITY", "console.log in Production", "No console.log statements found");
    }
  }

  // Test 2.5: Check for localhost/127.0.0.1 in source
  const localhostCheck = shellCheck("grep -rn 'localhost\\|127\\.0\\.0\\.1' --include='*.js' --include='*.ts' --include='*.py' . 2>/dev/null | grep -iv 'node_modules' | grep -iv 'test' | wc -l");
  if (localhostCheck.ok) {
    const count = parseInt(localhostCheck.output, 10);
    if (count > 5) {
      fail("SECURITY", "Localhost References", `Found ${count} localhost/127.0.0.1 references. Use environment variables instead.`);
    } else if (count > 0) {
      warn("SECURITY", "Localhost References", `Found ${count} localhost references. Should be configurable.`);
    } else {
      pass("SECURITY", "Localhost References", "No hardcoded localhost references");
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// TEST SUITE 3: CODE ARCHITECTURE
// ═══════════════════════════════════════════════════════════════
async function testArchitecture() {
  console.log("\n═══ TEST SUITE 3: Code Architecture ═══");

  // Test 3.1: Check for God classes (files > 50KB)
  const bigFiles = shellCheck("find . -name '*.js' -o -name '*.ts' -o -name '*.py' 2>/dev/null | grep -v node_modules | xargs ls -la 2>/dev/null | awk '$5 > 50000 {print $5, $9}'");
  if (bigFiles.ok && bigFiles.output.length > 0) {
    fail("ARCH", "God Classes", `Files exceeding 50KB (must decompose):\n${bigFiles.output}`);
  } else if (bigFiles.ok) {
    pass("ARCH", "God Classes", "No files exceed 50KB threshold");
  } else {
    skip("ARCH", "God Classes", "Cannot scan directory");
  }

  // Test 3.2: Check for duplicate lockfiles
  const hasNpm = fs.existsSync("package-lock.json");
  const hasPnpm = fs.existsSync("pnpm-lock.yaml");
  const hasYarn = fs.existsSync("yarn.lock");
  const lockCount = [hasNpm, hasPnpm, hasYarn].filter(Boolean).length;
  if (lockCount > 1) {
    fail("ARCH", "Duplicate Lockfiles", `Found ${lockCount} lockfiles. Standardize on one package manager.`);
  } else if (lockCount === 1) {
    pass("ARCH", "Package Manager", "Single lockfile detected");
  } else {
    warn("ARCH", "Package Manager", "No lockfile found");
  }

  // Test 3.3: Check for health endpoints
  const healthCheck = shellCheck("grep -rn 'healthz\\|/health\\|readiness' --include='*.js' --include='*.ts' . 2>/dev/null | grep -iv 'node_modules' | wc -l");
  if (healthCheck.ok) {
    const count = parseInt(healthCheck.output, 10);
    if (count >= 3) {
      pass("ARCH", "Health Endpoints", `Found ${count} health endpoint references`);
    } else if (count > 0) {
      warn("ARCH", "Health Endpoints", `Only ${count} health endpoint references. All services need /healthz, /readiness, /startup.`);
    } else {
      fail("ARCH", "Health Endpoints", "No health endpoints found. Critical for container orchestration.");
    }
  }

  // Test 3.4: Check for structured logging
  const pinoCheck = shellCheck("grep -rn 'pino\\|structlog\\|winston\\|bunyan' --include='*.js' --include='*.ts' --include='*.py' . 2>/dev/null | grep -iv 'node_modules' | wc -l");
  if (pinoCheck.ok) {
    const count = parseInt(pinoCheck.output, 10);
    if (count > 0) {
      pass("ARCH", "Structured Logging", `Found ${count} structured logging references`);
    } else {
      fail("ARCH", "Structured Logging", "No structured logging library detected. Using console.log is not production-ready.");
    }
  }

  // Test 3.5: Check for test files
  const testCount = shellCheck("find . -name '*.test.*' -o -name '*.spec.*' -o -name 'test_*' 2>/dev/null | grep -v node_modules | wc -l");
  if (testCount.ok) {
    const count = parseInt(testCount.output, 10);
    if (count >= 10) {
      pass("ARCH", "Test Coverage", `Found ${count} test files`);
    } else if (count > 0) {
      warn("ARCH", "Test Coverage", `Only ${count} test files. Target 80%+ code coverage.`);
    } else {
      fail("ARCH", "Test Coverage", "No test files found. Critical paths must have tests.");
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// TEST SUITE 4: INFRASTRUCTURE
// ═══════════════════════════════════════════════════════════════
async function testInfrastructure() {
  console.log("\n═══ TEST SUITE 4: Infrastructure ═══");

  // Test 4.1: Docker availability
  const docker = shellCheck("docker --version 2>/dev/null");
  if (docker.ok) {
    pass("INFRA", "Docker", `Available: ${docker.output}`);
  } else {
    warn("INFRA", "Docker", "Docker not available. Required for containerized deployment.");
  }

  // Test 4.2: Node.js version
  const nodeVer = shellCheck("node --version 2>/dev/null");
  if (nodeVer.ok) {
    const major = parseInt(nodeVer.output.replace("v", ""), 10);
    if (major >= 20) {
      pass("INFRA", "Node.js", `Version ${nodeVer.output} (recommended: 20+)`);
    } else {
      warn("INFRA", "Node.js", `Version ${nodeVer.output}. Recommend upgrading to 20+.`);
    }
  }

  // Test 4.3: Python version
  const pyVer = shellCheck("python3 --version 2>/dev/null || python --version 2>/dev/null");
  if (pyVer.ok) {
    pass("INFRA", "Python", pyVer.output);
  } else {
    warn("INFRA", "Python", "Python not available. Required for ML pipelines.");
  }

  // Test 4.4: Redis connectivity (if configured)
  const redisUrl = process.env.REDIS_URL || process.env.REDIS_HOST;
  if (redisUrl) {
    const redis = shellCheck(`redis-cli -h ${redisUrl} ping 2>/dev/null`);
    if (redis.ok && redis.output.includes("PONG")) {
      pass("INFRA", "Redis", `Connected to ${redisUrl}`);
    } else {
      fail("INFRA", "Redis", `Cannot reach Redis at ${redisUrl}. Agent communication bus is down.`);
    }
  } else {
    skip("INFRA", "Redis", "No REDIS_URL configured. Set environment variable.");
  }

  // Test 4.5: PostgreSQL connectivity (if configured)
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    info("INFRA", "PostgreSQL", `DATABASE_URL is configured (connection test requires pg client)`);
  } else {
    skip("INFRA", "PostgreSQL", "No DATABASE_URL configured.");
  }
}

// ═══════════════════════════════════════════════════════════════
// TEST SUITE 5: CONNECTED SERVICES
// ═══════════════════════════════════════════════════════════════
async function testConnectedServices() {
  console.log("\n═══ TEST SUITE 5: Connected Services ═══");

  // Test 5.1: Tradovate API reachability
  try {
    const res = await httpGet("https://demo.tradovateapi.com/v1/auth/accesstokenrequest", 5000);
    pass("SERVICES", "Tradovate API", `Reachable (status ${res.status})`);
  } catch (e) {
    warn("SERVICES", "Tradovate API", `Not reachable: ${e.message}`);
  }

  // Test 5.2: AlphaVantage API
  try {
    const res = await httpGet("https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=SPY&apikey=demo", 5000);
    if (res.status === 200) {
      pass("SERVICES", "AlphaVantage API", "Reachable with demo key");
    }
  } catch (e) {
    warn("SERVICES", "AlphaVantage API", `Not reachable: ${e.message}`);
  }

  // Test 5.3: Hummingbot MCP
  try {
    const res = await httpGet("https://hummingbot.org", 5000);
    pass("SERVICES", "Hummingbot", `Website reachable (MCP server requires local deployment)`);
  } catch (e) {
    warn("SERVICES", "Hummingbot", "Not reachable");
  }
}

// ═══════════════════════════════════════════════════════════════
// GENERATE REPORT
// ═══════════════════════════════════════════════════════════════
function generateReport() {
  console.log("\n═══════════════════════════════════════════════════");
  console.log("         HEADY SYSTEM — TEST PROTOCOL REPORT       ");
  console.log("═══════════════════════════════════════════════════");

  const passed = results.filter(r => r.symbol === "✅").length;
  const failed = results.filter(r => r.symbol === "❌").length;
  const warned = results.filter(r => r.symbol === "⚠️").length;
  const skipped = results.filter(r => r.symbol === "⏭️").length;
  const total = results.length;
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\nTotal tests: ${total}`);
  console.log(`  ✅ Passed:  ${passed}`);
  console.log(`  ❌ Failed:  ${failed}`);
  console.log(`  ⚠️  Warned:  ${warned}`);
  console.log(`  ⏭️  Skipped: ${skipped}`);
  console.log(`\nExecution time: ${elapsed}s`);
  console.log(`\nHealth Score: ${total > 0 ? ((passed / (total - skipped)) * 100).toFixed(1) : 0}%`);

  if (failed > 0) {
    console.log("\n─── CRITICAL FAILURES (Must Fix) ───");
    results.filter(r => r.symbol === "❌").forEach(r => {
      console.log(`  • [${r.category}] ${r.name}: ${r.detail}`);
    });
  }

  // Write structured JSON report for ingestion by Heady system
  const report = {
    generated: new Date().toISOString(),
    elapsed_seconds: parseFloat(elapsed),
    summary: { total, passed, failed, warned, skipped },
    health_score: total > 0 ? parseFloat(((passed / (total - skipped)) * 100).toFixed(1)) : 0,
    results: results,
  };
  fs.writeFileSync("heady-test-report.json", JSON.stringify(report, null, 2));
  console.log("\nStructured report saved: heady-test-report.json");
}

// ═══════════════════════════════════════════════════════════════
// MAIN EXECUTION
// ═══════════════════════════════════════════════════════════════
async function main() {
  console.log("╔═══════════════════════════════════════════════════╗");
  console.log("║    HEADY SYSTEM — Master Test Protocol v1.0.0    ║");
  console.log("║    HeadySystems Inc. — March 2026                ║");
  console.log("╚═══════════════════════════════════════════════════╝");

  await testMCPServer();
  await testSecurity();
  await testArchitecture();
  await testInfrastructure();
  await testConnectedServices();
  generateReport();
}

main().catch(e => {
  console.error("Test protocol fatal error:", e);
  process.exit(1);
});
