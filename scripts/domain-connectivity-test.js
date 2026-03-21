// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: scripts/domain-connectivity-test.js                                                    ║
// ║  LAYER: automation                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const yaml = require('js-yaml');

const REGISTRY_PATH = path.join(__dirname, '..', 'configs', 'service-domains.yaml');
const TEST_ENVIRONMENTS = (process.env.HEADY_DOMAIN_TEST_ENVS || 'production,staging')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const REQUEST_TIMEOUT_MS = Number(process.env.HEADY_DOMAIN_TEST_TIMEOUT_MS || 8000);

function loadRegistry(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return yaml.load(raw);
}

function toUrl(value) {
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  return `https://${value}`;
}

function isPlaceholderDomain(value) {
  return value.includes('{') || value.includes('}');
}

function collectDomainTargets(registry) {
  const targets = [];
  const stack = [{ key: 'root', value: registry }];

  while (stack.length > 0) {
    const { key, value } = stack.pop();
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;

    const domainMap = value.domains;
    if (domainMap && typeof domainMap === 'object') {
      for (const env of TEST_ENVIRONMENTS) {
        const raw = domainMap[env];
        if (typeof raw !== 'string') continue;
        if (isPlaceholderDomain(raw)) continue;
        targets.push({
          service: key,
          environment: env,
          domain: raw,
          url: toUrl(raw)
        });
      }
    }

    for (const [childKey, childValue] of Object.entries(value)) {
      if (childKey === 'domains') continue;
      stack.push({ key: childKey, value: childValue });
    }
  }

  const deduped = new Map();
  for (const target of targets) {
    deduped.set(`${target.environment}:${target.url}`, target);
  }
  return Array.from(deduped.values()).sort((a, b) => a.url.localeCompare(b.url));
}

async function testTarget(target) {
  const start = Date.now();
  try {
    const response = await axios.get(target.url, {
      timeout: REQUEST_TIMEOUT_MS,
      validateStatus: () => true
    });
    const elapsed = Date.now() - start;
    const success = response.status >= 200 && response.status < 400;
    return {
      ...target,
      status: response.status,
      durationMs: elapsed,
      success
    };
  } catch (error) {
    return {
      ...target,
      status: 'error',
      durationMs: Date.now() - start,
      success: false,
      error: error.code || error.message
    };
  }
}

async function testDomainConnectivity() {
  const registry = loadRegistry(REGISTRY_PATH);
  const targets = collectDomainTargets(registry);

  if (targets.length === 0) {
    console.error('[domain-connectivity-test] No testable targets found in registry.');
    process.exit(1);
  }

  console.log(`[domain-connectivity-test] Testing ${targets.length} domains for environments: ${TEST_ENVIRONMENTS.join(', ')}`);
  const results = [];
  for (const target of targets) {
    // Keep requests sequential to avoid accidental rate-limit spikes during CI.
    results.push(await testTarget(target));
  }

  const failures = results.filter((result) => !result.success);
  const summary = {
    total: results.length,
    passed: results.length - failures.length,
    failed: failures.length
  };

  console.log('[domain-connectivity-test] Summary:', summary);
  if (failures.length > 0) {
    console.error('[domain-connectivity-test] Failures:');
    failures.forEach((failure) => {
      console.error(`- ${failure.url} [${failure.environment}] => ${failure.status}${failure.error ? ` (${failure.error})` : ''}`);
    });
    process.exit(1);
  }

  console.log('[domain-connectivity-test] All domains responded successfully.');
}

testDomainConnectivity().catch((error) => {
  console.error('[domain-connectivity-test] Fatal error:', error);
  process.exit(1);
});
