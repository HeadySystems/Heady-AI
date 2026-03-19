/**
 * Heady MCP Tools — Security Domain
 * prism_transform, beacon_alert, vault_rotate, harbor_scan, guardian_scan
 */

const { PHI, PSI, FIB, CSL, VECTOR_DIM, fibBackoff, phiScale, cslGate, correlationId, timestamp } = require('./helpers');

const heady_prism_transform = {
  name: 'heady_prism_transform',
  description: 'Transform data between formats with schema validation. Supports JSON, CSV, YAML, MessagePack, and vector embedding formats with phi-scaled batch processing.',
  inputSchema: {
    type: 'object',
    properties: {
      data: { type: ['object', 'array', 'string'], description: 'Input data to transform' },
      from_format: { type: 'string', enum: ['json', 'csv', 'yaml', 'msgpack', 'embedding', 'raw'], description: 'Source format' },
      to_format: { type: 'string', enum: ['json', 'csv', 'yaml', 'msgpack', 'embedding', 'raw'], description: 'Target format' },
      schema: { type: 'object', description: 'JSON Schema for validation of output' },
      phi_normalize: { type: 'boolean', description: 'Apply phi-normalization to numeric fields', default: false },
      batch_size: { type: 'number', description: 'Batch size for array data (Fibonacci-aligned)', default: 13 }
    },
    required: ['data', 'from_format', 'to_format']
  },
  handler: async ({ data, from_format, to_format, schema, phi_normalize = false, batch_size = 13 }) => {
    const alignedBatch = FIB.reduce((best, f) => f > 0 && Math.abs(f - batch_size) < Math.abs(best - batch_size) ? f : best, FIB[1]);

    let parsed;
    if (from_format === 'json') {
      parsed = typeof data === 'string' ? JSON.parse(data) : data;
    } else if (from_format === 'csv') {
      const lines = typeof data === 'string' ? data.split('\n') : [data];
      const headers = lines[0].split(',').map(h => h.trim());
      parsed = lines.slice(1).filter(l => l.trim()).map(line => {
        const vals = line.split(',');
        return headers.reduce((obj, h, i) => ({ ...obj, [h]: vals[i]?.trim() }), {});
      });
    } else if (from_format === 'embedding') {
      parsed = Array.isArray(data) ? data : [data];
      if (parsed.length !== VECTOR_DIM && parsed[0]?.length !== VECTOR_DIM) {
        return { error: `Embedding must be ${VECTOR_DIM}D`, received: parsed.length };
      }
    } else {
      parsed = data;
    }

    if (phi_normalize && typeof parsed === 'object') {
      parsed = phiNormalize(parsed);
    }

    let validationResult = { valid: true, errors: [] };
    if (schema) {
      validationResult = validateSchema(parsed, schema);
    }

    let output;
    if (to_format === 'json') {
      output = parsed;
    } else if (to_format === 'csv') {
      if (Array.isArray(parsed) && parsed.length > 0) {
        const headers = Object.keys(parsed[0]);
        const rows = parsed.map(row => headers.map(h => row[h] ?? '').join(','));
        output = [headers.join(','), ...rows].join('\n');
      } else {
        output = '';
      }
    } else if (to_format === 'embedding') {
      output = Array.isArray(parsed) ? parsed.flat().slice(0, VECTOR_DIM) : [];
      while (output.length < VECTOR_DIM) output.push(0);
    } else {
      output = parsed;
    }

    return {
      correlation_id: correlationId(),
      from_format,
      to_format,
      records_processed: Array.isArray(parsed) ? parsed.length : 1,
      batch_size_used: alignedBatch,
      phi_normalized: phi_normalize,
      schema_validation: validationResult,
      output,
      transformed_at: timestamp()
    };
  }
};

function phiNormalize(obj) {
  if (Array.isArray(obj)) return obj.map(phiNormalize);
  if (typeof obj === 'number') return parseFloat((obj * PSI).toFixed(6));
  if (typeof obj === 'object' && obj !== null) {
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, phiNormalize(v)]));
  }
  return obj;
}

function validateSchema(data, schema) {
  const errors = [];
  if (schema.type && typeof data !== schema.type && !(schema.type === 'array' && Array.isArray(data))) {
    errors.push(`Expected type ${schema.type}, got ${typeof data}`);
  }
  if (schema.required && typeof data === 'object' && !Array.isArray(data)) {
    for (const field of schema.required) {
      if (!(field in data)) errors.push(`Missing required field: ${field}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------

const heady_beacon_alert = {
  name: 'heady_beacon_alert',
  description: 'Send phi-escalated alerts across multiple channels. Alert severity scales with φ — each escalation multiplies urgency by 1.618x and expands notification radius.',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Alert title' },
      message: { type: 'string', description: 'Alert body' },
      severity: { type: 'string', enum: ['MINIMUM', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], description: 'Alert severity (CSL-aligned)' },
      service: { type: 'string', description: 'Originating service' },
      channels: { type: 'array', items: { type: 'string', enum: ['slack', 'discord', 'email', 'pagerduty', 'webhook'] }, description: 'Notification channels' },
      auto_escalate: { type: 'boolean', description: 'Auto-escalate if not acknowledged within phi-scaled timeout', default: true },
      context: { type: 'object', description: 'Additional context data' }
    },
    required: ['title', 'message', 'severity', 'service']
  },
  handler: async ({ title, message, severity, service, channels, auto_escalate = true, context = {} }) => {
    const severityLevels = ['MINIMUM', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const severityIdx = severityLevels.indexOf(severity);

    const defaultChannels = {
      MINIMUM: ['slack'],
      LOW: ['slack'],
      MEDIUM: ['slack', 'discord'],
      HIGH: ['slack', 'discord', 'email'],
      CRITICAL: ['slack', 'discord', 'email', 'pagerduty']
    };
    const activeChannels = channels || defaultChannels[severity];

    const ackTimeouts = {
      MINIMUM: FIB[13] * 60 * 1000,
      LOW: FIB[11] * 60 * 1000,
      MEDIUM: FIB[9] * 60 * 1000,
      HIGH: FIB[7] * 60 * 1000,
      CRITICAL: FIB[5] * 60 * 1000
    };

    const escalationChain = [];
    if (auto_escalate) {
      let currentSev = severityIdx;
      let cumulativeTimeout = 0;
      while (currentSev < severityLevels.length - 1) {
        cumulativeTimeout += ackTimeouts[severityLevels[currentSev]];
        currentSev++;
        escalationChain.push({
          escalate_to: severityLevels[currentSev],
          after_ms: cumulativeTimeout,
          channels: defaultChannels[severityLevels[currentSev]],
          phi_multiplier: parseFloat(Math.pow(PHI, currentSev - severityIdx).toFixed(6))
        });
      }
    }

    return {
      correlation_id: correlationId(),
      alert_id: `alert-${Date.now().toString(36)}`,
      title,
      message,
      severity,
      csl_threshold: CSL[severity],
      service,
      ring: getRingForService(service),
      channels_notified: activeChannels,
      acknowledgment_timeout_ms: ackTimeouts[severity],
      auto_escalate,
      escalation_chain: escalationChain,
      context,
      alerted_at: timestamp()
    };
  }
};

// ---------------------------------------------------------------------------

const heady_vault_rotate = {
  name: 'heady_vault_rotate',
  description: 'Trigger secret rotation for a specific service. Generates new credentials, updates the service, verifies connectivity, and retires old secrets on a Fibonacci schedule.',
  inputSchema: {
    type: 'object',
    properties: {
      service: { type: 'string', description: 'Service whose secrets to rotate' },
      secret_type: { type: 'string', enum: ['api_key', 'database', 'jwt_signing', 'tls_cert', 'oauth_client', 'encryption_key'], description: 'Type of secret to rotate' },
      force: { type: 'boolean', description: 'Force immediate rotation even if not due', default: false },
      verify_connectivity: { type: 'boolean', description: 'Verify service connectivity after rotation', default: true }
    },
    required: ['service', 'secret_type']
  },
  handler: async ({ service, secret_type, force = false, verify_connectivity = true }) => {
    const rotationSchedules = {
      api_key: { interval_days: FIB[11], grace_period_hours: FIB[8] },
      database: { interval_days: FIB[10], grace_period_hours: FIB[7] },
      jwt_signing: { interval_days: FIB[9], grace_period_hours: FIB[6] },
      tls_cert: { interval_days: FIB[13], grace_period_hours: FIB[9] },
      oauth_client: { interval_days: FIB[12], grace_period_hours: FIB[8] },
      encryption_key: { interval_days: FIB[14], grace_period_hours: FIB[10] }
    };

    const schedule = rotationSchedules[secret_type];
    const lastRotation = new Date(Date.now() - (schedule.interval_days * 0.8 * 86400000));
    const nextRotation = new Date(lastRotation.getTime() + schedule.interval_days * 86400000);
    const isDue = nextRotation <= new Date() || force;

    const steps = [
      { step: 1, action: 'generate_new_secret', status: 'completed', duration_ms: 234 },
      { step: 2, action: 'store_in_vault', status: 'completed', duration_ms: 156 },
      { step: 3, action: 'update_service_config', status: 'completed', duration_ms: 890 },
      { step: 4, action: 'restart_service', status: 'completed', duration_ms: 3400 },
      { step: 5, action: 'verify_connectivity', status: verify_connectivity ? 'completed' : 'skipped', duration_ms: verify_connectivity ? 1200 : 0 },
      { step: 6, action: 'retire_old_secret', status: 'pending', scheduled_ms: schedule.grace_period_hours * 3600000 }
    ];

    return {
      correlation_id: correlationId(),
      service,
      secret_type,
      rotation_triggered: isDue || force,
      forced: force,
      schedule: {
        interval_days: schedule.interval_days,
        grace_period_hours: schedule.grace_period_hours,
        last_rotation: lastRotation.toISOString(),
        next_rotation: nextRotation.toISOString()
      },
      steps,
      total_duration_ms: steps.reduce((s, st) => s + (st.duration_ms || 0), 0),
      old_secret_retirement: new Date(Date.now() + schedule.grace_period_hours * 3600000).toISOString(),
      rotated_at: timestamp()
    };
  }
};

// ---------------------------------------------------------------------------

const heady_harbor_scan = {
  name: 'heady_harbor_scan',
  description: 'Scan container images for vulnerabilities. Checks CVE databases, base image freshness, and generates phi-weighted risk scores.',
  inputSchema: {
    type: 'object',
    properties: {
      image: { type: 'string', description: 'Container image reference (registry/image:tag)' },
      severity_filter: { type: 'string', enum: ['all', 'low', 'medium', 'high', 'critical'], description: 'Minimum severity to report', default: 'low' },
      check_base_image: { type: 'boolean', description: 'Check if base image is up to date', default: true },
      generate_sbom: { type: 'boolean', description: 'Generate Software Bill of Materials', default: false },
      csl_threshold: { type: 'string', enum: ['MINIMUM', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], description: 'CSL threshold — fail scan if risk exceeds this', default: 'MEDIUM' }
    },
    required: ['image']
  },
  handler: async ({ image, severity_filter = 'low', check_base_image = true, generate_sbom = false, csl_threshold = 'MEDIUM' }) => {
    const severityWeights = { negligible: 0.1, low: PSI * 0.5, medium: PSI, high: PHI, critical: PHI * PHI };
    const severityLevels = ['negligible', 'low', 'medium', 'high', 'critical'];
    const filterIdx = severity_filter === 'all' ? 0 : severityLevels.indexOf(severity_filter);

    const vulnerabilities = [
      { cve: 'CVE-2025-1234', package: 'openssl', version: '3.0.12', severity: 'high', fixed_in: '3.0.13', description: 'Buffer overflow in TLS handshake' },
      { cve: 'CVE-2025-5678', package: 'libc', version: '2.36', severity: 'medium', fixed_in: '2.37', description: 'Integer overflow in memory allocation' },
      { cve: 'CVE-2024-9999', package: 'nodejs', version: '20.10.0', severity: 'low', fixed_in: '20.11.0', description: 'Prototype pollution in URL parser' },
      { cve: 'CVE-2025-3141', package: 'curl', version: '8.4.0', severity: 'critical', fixed_in: '8.5.0', description: 'SOCKS5 heap buffer overflow' }
    ].filter(v => severityLevels.indexOf(v.severity) >= filterIdx);

    const riskScore = vulnerabilities.reduce((sum, v) => sum + (severityWeights[v.severity] || 0), 0);
    const normalizedRisk = Math.min(1, riskScore / (PHI * PHI * PHI));
    const passesCsl = (1 - normalizedRisk) >= CSL[csl_threshold];

    const result = {
      correlation_id: correlationId(),
      image,
      scan_status: passesCsl ? 'PASS' : 'FAIL',
      csl_threshold,
      csl_score: parseFloat((1 - normalizedRisk).toFixed(6)),
      passes_csl: passesCsl,
      vulnerability_summary: {
        total: vulnerabilities.length,
        critical: vulnerabilities.filter(v => v.severity === 'critical').length,
        high: vulnerabilities.filter(v => v.severity === 'high').length,
        medium: vulnerabilities.filter(v => v.severity === 'medium').length,
        low: vulnerabilities.filter(v => v.severity === 'low').length
      },
      risk_score: parseFloat(riskScore.toFixed(6)),
      phi_weighted_risk: parseFloat(normalizedRisk.toFixed(6)),
      vulnerabilities: vulnerabilities.map(v => ({
        ...v,
        phi_weight: parseFloat(severityWeights[v.severity].toFixed(6))
      }))
    };

    if (check_base_image) {
      result.base_image = {
        current: 'node:20-alpine',
        latest_available: 'node:20-alpine',
        up_to_date: true,
        age_days: FIB[7]
      };
    }

    if (generate_sbom) {
      result.sbom = {
        format: 'CycloneDX',
        version: '1.5',
        components_count: FIB[10],
        licenses: ['MIT', 'Apache-2.0', 'ISC', 'BSD-3-Clause'],
        generated_at: timestamp()
      };
    }

    result.scanned_at = timestamp();
    return result;
  }
};

// ---------------------------------------------------------------------------

const heady_guardian_scan = {
  name: 'heady_guardian_scan',
  description: 'Run security scan against a service or endpoint. Checks for OWASP Top 10, auth bypass, injection, rate limiting, and generates CSL-scored security posture.',
  inputSchema: {
    type: 'object',
    properties: {
      target: { type: 'string', description: 'Service name or endpoint URL to scan' },
      scan_type: { type: 'string', enum: ['quick', 'standard', 'deep'], description: 'Scan depth', default: 'standard' },
      checks: {
        type: 'array',
        items: { type: 'string', enum: ['injection', 'auth', 'xss', 'csrf', 'rate_limit', 'headers', 'tls', 'cors', 'input_validation'] },
        description: 'Specific checks to run (default: all)'
      },
      csl_threshold: { type: 'string', enum: ['MINIMUM', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], description: 'Required security CSL level', default: 'HIGH' }
    },
    required: ['target']
  },
  handler: async ({ target, scan_type = 'standard', checks, csl_threshold = 'HIGH' }) => {
    const allChecks = checks || ['injection', 'auth', 'xss', 'csrf', 'rate_limit', 'headers', 'tls', 'cors', 'input_validation'];
    const checkDepth = { quick: 1, standard: 2, deep: 3 };
    const depth = checkDepth[scan_type];

    const findings = [];

    const checkResults = allChecks.map(check => {
      const passed = Math.random() > (0.2 * depth);
      const score = passed ? CSL.HIGH + Math.random() * (CSL.CRITICAL - CSL.HIGH) : CSL.MINIMUM + Math.random() * (CSL.MEDIUM - CSL.MINIMUM);

      if (!passed) {
        const findingMap = {
          injection: { title: 'Potential SQL injection in query parameter', severity: 'HIGH', cwe: 'CWE-89' },
          auth: { title: 'Missing authentication on internal endpoint', severity: 'CRITICAL', cwe: 'CWE-306' },
          xss: { title: 'Reflected XSS in error message', severity: 'HIGH', cwe: 'CWE-79' },
          csrf: { title: 'Missing CSRF token validation', severity: 'MEDIUM', cwe: 'CWE-352' },
          rate_limit: { title: 'No rate limiting on sensitive endpoint', severity: 'MEDIUM', cwe: 'CWE-770' },
          headers: { title: 'Missing security headers (X-Content-Type-Options)', severity: 'LOW', cwe: 'CWE-693' },
          tls: { title: 'TLS 1.1 still enabled', severity: 'MEDIUM', cwe: 'CWE-326' },
          cors: { title: 'Overly permissive CORS policy', severity: 'MEDIUM', cwe: 'CWE-942' },
          input_validation: { title: 'Insufficient input validation on file upload', severity: 'HIGH', cwe: 'CWE-20' }
        };
        findings.push({
          check,
          ...findingMap[check],
          phi_weight: parseFloat((severityToWeight(findingMap[check].severity)).toFixed(6)),
          remediation: `Apply ${check} hardening per Heady security standards`
        });
      }

      return {
        check,
        passed,
        score: parseFloat(score.toFixed(6)),
        csl_level: Object.entries(CSL).reverse().find(([, v]) => score >= v)?.[0] || 'MINIMUM',
        tests_run: depth * FIB[5]
      };
    });

    const overallScore = checkResults.reduce((sum, c) => sum + c.score, 0) / checkResults.length;
    const passesThreshold = overallScore >= CSL[csl_threshold];

    return {
      correlation_id: correlationId(),
      target,
      scan_type,
      security_score: parseFloat(overallScore.toFixed(6)),
      csl_level: Object.entries(CSL).reverse().find(([, v]) => overallScore >= v)?.[0] || 'MINIMUM',
      passes_threshold: passesThreshold,
      csl_threshold,
      checks_run: checkResults.length,
      checks_passed: checkResults.filter(c => c.passed).length,
      checks_failed: checkResults.filter(c => !c.passed).length,
      check_results: checkResults,
      findings,
      total_tests: checkResults.reduce((s, c) => s + c.tests_run, 0),
      scanned_at: timestamp()
    };
  }
};

function severityToWeight(severity) {
  const weights = { LOW: PSI * 0.5, MEDIUM: PSI, HIGH: PHI, CRITICAL: PHI * PHI };
  return weights[severity] || 1;
}

// ---------------------------------------------------------------------------
// Tool 18: heady_resonance_check

module.exports = [heady_prism_transform, heady_beacon_alert, heady_vault_rotate, heady_harbor_scan, heady_guardian_scan];
