#!/usr/bin/env python3
"""Generate all 50 Heady service implementations."""

import os
import json

BASE = "/home/user/workspace/heady-system-build"
SERVICES_DIR = f"{BASE}/services"

# Complete list of 50 services with metadata
SERVICES = [
    # Core platform
    {"id": "heady-manager",           "port": 3301, "domain": "headysystems.com",    "desc": "Primary orchestration manager — 21-stage pipeline controller",        "upstreams": ["heady-gateway","heady-mcp","heady-brain"]},
    {"id": "heady-gateway",           "port": 3302, "domain": "headyapi.com",         "desc": "API Gateway — unified layer with rate limiting, auth, CSL routing",    "upstreams": ["heady-manager","heady-auth","heady-router"]},
    {"id": "heady-mcp",               "port": 3303, "domain": "headymcp.com",         "desc": "MCP Gateway — 42 registered MCP tools, JSON-RPC 2.0 server",          "upstreams": ["heady-manager","heady-auth"]},
    {"id": "heady-brain",             "port": 3304, "domain": "headysystems.com",     "desc": "HeadyBrain — 7-archetype cognitive orchestration, CSL fusion",         "upstreams": ["heady-vector-memory","heady-inference-gateway"]},
    {"id": "heady-soul",              "port": 3305, "domain": "headyme.com",          "desc": "HeadySoul — user intent control plane, pipeline entry point",           "upstreams": ["heady-brain","heady-manager"]},
    {"id": "heady-hive",              "port": 3306, "domain": "headybee.co",          "desc": "HeadyHive — bee factory, spawning/managing 10K concurrent bees",       "upstreams": ["heady-swarm-coordinator","heady-seventeen-swarm"]},
    {"id": "heady-orchestration",     "port": 3307, "domain": "headysystems.com",     "desc": "Orchestration layer — task DAG execution, stage transitions, gates",    "upstreams": ["heady-manager","heady-hive","heady-pipeline-core"]},
    {"id": "heady-router",            "port": 3308, "domain": "headysystems.com",     "desc": "Domain router — CSL cosine matching across concurrent-equals domains",            "upstreams": ["heady-brain","heady-vector-memory"]},
    {"id": "heady-auth",              "port": 3309, "domain": "headysystems.com",     "desc": "Auth service — JWT/Ed25519 validation, mTLS, service identity",        "upstreams": []},
    {"id": "heady-drupal",            "port": 3310, "domain": "headyconnection.org",  "desc": "Drupal integration — headyconnection.org CMS bridge and proxy",        "upstreams": ["heady-auth","heady-cache"]},
    # Intelligence services
    {"id": "heady-vector-memory",     "port": 3311, "domain": "headysystems.com",     "desc": "3D spatial vector memory — pgvector backed RAG with Graph traversal",  "upstreams": ["heady-embeddings"]},
    {"id": "heady-embeddings",        "port": 3312, "domain": "headysystems.com",     "desc": "Embedding service — local + Vertex AI embedding generation",           "upstreams": []},
    {"id": "heady-inference-gateway", "port": 3313, "domain": "headysystems.com",     "desc": "Inference gateway — multi-model routing: Claude/GPT/Gemini/Groq/Ollama","upstreams": []},
    {"id": "heady-model-router",      "port": 3314, "domain": "headysystems.com",     "desc": "Model router — CSL-based model selection, capability matching",        "upstreams": ["heady-inference-gateway","heady-brain"]},
    {"id": "heady-buddy",             "port": 3315, "domain": "headybuddy.com",       "desc": "HeadyBuddy — AI companion, persistent memory, empathic personas",      "upstreams": ["heady-brain","heady-vector-memory","heady-soul"]},
    {"id": "heady-coder",             "port": 3316, "domain": "heady.io",             "desc": "HeadyCoder — autonomous code generation, review, and testing",         "upstreams": ["heady-brain","heady-inference-gateway"]},
    {"id": "heady-researcher",        "port": 3317, "domain": "heady.io",             "desc": "HeadyResearcher — Perplexity-powered research and synthesis",         "upstreams": ["heady-inference-gateway","heady-vector-memory"]},
    {"id": "heady-battle",            "port": 3318, "domain": "headysystems.com",     "desc": "HeadyBattle — Arena mode multi-model competition, Monte Carlo eval",   "upstreams": ["heady-inference-gateway","heady-brain"]},
    {"id": "heady-council",           "port": 3319, "domain": "headysystems.com",     "desc": "HeadyCouncil — 7-model deliberation, CSL consensus gate",             "upstreams": ["heady-inference-gateway","heady-brain"]},
    {"id": "heady-mc",                "port": 3320, "domain": "headysystems.com",     "desc": "HeadyMC — Monte Carlo simulation, 1K+ scenario evaluation",           "upstreams": ["heady-brain"]},
    # Resilience services
    {"id": "heady-circuit-breaker",   "port": 3321, "domain": "headysystems.com",     "desc": "Circuit breaker service — flow, pause, and probe recovery state machine",       "upstreams": []},
    {"id": "heady-saga",              "port": 3322, "domain": "headysystems.com",     "desc": "Saga orchestrator — distributed transactions with compensating txns",  "upstreams": ["heady-event-store","heady-cqrs"]},
    {"id": "heady-bulkhead",          "port": 3323, "domain": "headysystems.com",     "desc": "Bulkhead isolation — resource pool partitioning, Fibonacci-snapped",   "upstreams": []},
    {"id": "heady-event-store",       "port": 3324, "domain": "headysystems.com",     "desc": "Event store — immutable event sourcing, time-travel debug replay",     "upstreams": []},
    {"id": "heady-cqrs",              "port": 3325, "domain": "headysystems.com",     "desc": "CQRS bus — command/query separation, read/write path optimization",    "upstreams": ["heady-event-store"]},
    {"id": "heady-self-healing",      "port": 3326, "domain": "headysystems.com",     "desc": "Self-healing mesh — auto-discovery, register, recovery from partition", "upstreams": []},
    {"id": "heady-auto-tuner",        "port": 3327, "domain": "headysystems.com",     "desc": "Auto-tuner — runtime φ-scaling of concurrency, timeout, batch size",  "upstreams": ["heady-observability"]},
    {"id": "heady-pool-router",       "port": 3328, "domain": "headysystems.com",     "desc": "Concurrent pool router — Fibonacci-ratio allocation across active, shared, buffer, and reserve execution lanes","upstreams": ["heady-vector-memory"]},
    # Swarm services
    {"id": "heady-bee-factory",       "port": 3329, "domain": "headybee.co",          "desc": "Bee factory — spawn/manage/retire 10,000 concurrent bees, 89 types",  "upstreams": ["heady-hive"]},
    {"id": "heady-swarm-coordinator", "port": 3330, "domain": "headybee.co",          "desc": "Swarm coordinator — cross-swarm messaging, < 10ms latency target",    "upstreams": ["heady-hive"]},
    {"id": "heady-seventeen-swarm",   "port": 3331, "domain": "headybee.co",          "desc": "17-swarm orchestrator — golden-angle ring topology, CSL gates",       "upstreams": ["heady-swarm-coordinator","heady-bee-factory"]},
    # Pipeline services
    {"id": "heady-pipeline-core",     "port": 3332, "domain": "headysystems.com",     "desc": "Pipeline core — 21-stage HCFullPipeline v4.0, phi-scaled timeouts",   "upstreams": ["heady-manager","heady-brain"]},
    {"id": "heady-csl-judge",         "port": 3333, "domain": "headysystems.com",     "desc": "CSL judge/scorer — semantic gate evaluation, CSL Ternary Gate, receipts", "upstreams": ["heady-vector-memory"]},
    {"id": "heady-auto-success",      "port": 3334, "domain": "headysystems.com",     "desc": "Auto-Success Engine — φ⁷-cycle (29,034ms) background task orchestration","upstreams": ["heady-manager"]},
    # Intelligence/safety
    {"id": "heady-hallucination-watchdog","port": 3335, "domain": "headysystems.com", "desc": "Hallucination detection watchdog — real-time output quality monitoring", "upstreams": ["heady-inference-gateway"]},
    {"id": "heady-evolution-engine",  "port": 3336, "domain": "headysystems.com",     "desc": "Evolution engine — continuous learning, pattern database updates",     "upstreams": ["heady-vector-memory","heady-event-store"]},
    {"id": "heady-budget-tracker",    "port": 3337, "domain": "headysystems.com",     "desc": "Budget tracker — token/cost tracking per bee, swarm, pipeline stage",  "upstreams": []},
    {"id": "heady-receipt-signer",    "port": 3338, "domain": "headysystems.com",     "desc": "Receipt signer — Ed25519 cryptographic audit trail for every action",  "upstreams": []},
    {"id": "heady-persona-router",    "port": 3339, "domain": "headyme.com",          "desc": "Persona router — 10 animal archetypes, CSL empathic adaptation",       "upstreams": ["heady-brain","heady-soul"]},
    # Observability
    {"id": "heady-observability",     "port": 3340, "domain": "headysystems.com",     "desc": "Observability kernel — self-awareness telemetry, confidence monitoring","upstreams": []},
    {"id": "heady-telemetry",         "port": 3341, "domain": "headysystems.com",     "desc": "Telemetry aggregator — OTLP collector, Prometheus scrape, Grafana feed","upstreams": ["heady-observability"]},
    # Platform/edge
    {"id": "heady-drupal-proxy",      "port": 3342, "domain": "headyconnection.org",  "desc": "Drupal reverse proxy — headyconnection.org content delivery layer",    "upstreams": ["heady-drupal","heady-auth"]},
    {"id": "heady-cf-worker",         "port": 3343, "domain": "headysystems.com",     "desc": "Cloudflare Worker bridge — edge KV, Durable Objects, D1 integration", "upstreams": []},
    {"id": "heady-federation",        "port": 3344, "domain": "heady.io",             "desc": "Module federation — micro-frontend composition, versioned contracts",  "upstreams": []},
    {"id": "heady-snapshot",          "port": 3345, "domain": "headysystems.com",     "desc": "Snapshot service — point-in-time state capture, time-travel restore",  "upstreams": ["heady-event-store"]},
    {"id": "heady-sandbox",           "port": 3346, "domain": "heady.io",             "desc": "Sandbox service — isolated execution environment for code evaluation",  "upstreams": []},
    # Domain-specific
    {"id": "heady-trader",            "port": 3347, "domain": "headyme.com",          "desc": "Heady Trader — autonomous trading intelligence, phi-scaled market safeguards", "upstreams": ["heady-brain","heady-mc"]},
    {"id": "heady-ableton",           "port": 3348, "domain": "headyme.com",          "desc": "Ableton edge — Cloud MIDI sequencer, SysEx edge node integration",     "upstreams": ["heady-brain"]},
    {"id": "heady-lens",              "port": 3349, "domain": "headylens.ai",         "desc": "HeadyLens — AR overlay intelligence, real-time visual context",        "upstreams": ["heady-brain","heady-inference-gateway"]},
    {"id": "heady-cache",             "port": 3350, "domain": "headysystems.com",     "desc": "Cache service — φ⁸-TTL distributed cache, CSL-keyed invalidation",    "upstreams": []},
]

assert len(SERVICES) == 50, f"Expected 50 services, got {len(SERVICES)}"

SERVICE_TEMPLATE = '''/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  {SERVICE_ID} — Service Entry Point                              ║
 * ║  {SERVICE_DESC}                                                  ║
 * ║  © 2026 HeadySystems Inc. — 60+ Provisional Patents             ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Domain:    {DOMAIN}
 * Port:      {PORT}
 * Upstreams: {UPSTREAMS}
 *
 * Middleware stack (in order):
 *   1. OpenTelemetry tracing init
 *   2. headyRequestId — trace/request ID propagation
 *   3. headyAutoContext — phi-context enrichment
 *   4. headyCslDomain — CSL domain matching across concurrent-equals domains
 *   5. headyAccessLog — structured pino JSON logging
 *   6. headyRateLimit — φ-scaled token bucket
 *   7. headySecurityHeaders — zero-trust headers
 *   8. [service-specific routes]
 *   9. headyErrorHandler — typed error handling
 *
 * Health endpoints:
 *   GET /health           — combined status
 *   GET /health/live      — Kubernetes liveness
 *   GET /health/ready     — Kubernetes readiness
 *   GET /health/startup   — Kubernetes startup
 *   GET /health/details   — phi-enriched full detail
 */

\'use strict\';

import express from \'express\';
import {{
  loadConfig,
  createLogger, logHealthEvent,
  initOtel, getTracer, createMetrics, headySpan,
  HealthRegistry, memoryCheck, envCheck,
  headyRequestId, headyAutoContext, headyCslDomain,
  headyAccessLog, headyRateLimit, headySecurityHeaders, headyErrorHandler,
  PSI, CSL_THRESHOLDS, TIMEOUTS, AUTO_SUCCESS_CYCLE_MS,
}} from \'@heady/platform\';

// ─── BOOTSTRAP ────────────────────────────────────────────────────────────────

const SERVICE_NAME = \'{SERVICE_ID}\';
const config = loadConfig(SERVICE_NAME);
const logger = createLogger({{
  service: SERVICE_NAME,
  domain:  config.domain,
  level:   process.env.LOG_LEVEL ?? \'info\',
}});

// Initialize OpenTelemetry BEFORE any imports that instrument
await initOtel({{ service: SERVICE_NAME, domain: config.domain }});
const tracer  = getTracer(SERVICE_NAME);
const metrics = createMetrics(SERVICE_NAME);

// ─── HEALTH REGISTRY ──────────────────────────────────────────────────────────

const health = new HealthRegistry({{
  service: SERVICE_NAME,
  version: config.version,
  domain:  config.domain,
}});

// Memory check (degraded if heap ratio > ψ = 0.618)
health.register(\'memory\', memoryCheck());

// Required environment variables
health.register(\'env\', envCheck([
  \'SERVICE_NAME\', \'SERVICE_VERSION\', \'HEADY_DOMAIN\', \'NODE_ENV\',
]));

{UPSTREAM_CHECKS}

// ─── EXPRESS APP ─────────────────────────────────────────────────────────────

const app = express();

// Body parsing
app.use(express.json({{ limit: \'1mb\' }}));
app.use(express.urlencoded({{ extended: false, limit: \'1mb\' }}));

// ── Middleware stack ──
app.use(headyRequestId());
app.use(headyAutoContext());           // HeadyAutoContext hooks
app.use(headyCslDomain([], null));     // CSL domain matching across concurrent-equals domains
app.use(headyAccessLog(logger));
app.use(headyRateLimit({{
  windowMs:    config.rateLimit.windowMs,
  maxRequests: config.rateLimit.maxRequests,
  burst:       config.rateLimit.burst,
}}));
app.use(headySecurityHeaders());

// ── Health routes ──
health.attachRoutes(app);

// ─── SERVICE ROUTES ───────────────────────────────────────────────────────────

/**
 * GET /status
 * Service identity and phi-context summary.
 */
app.get(\'/status\', (req, res) => {{
  res.json({{
    service:     SERVICE_NAME,
    version:     config.version,
    domain:      config.domain,
    status:      \'running\',
    phi_context: {{
      phi:         PSI + 1,              // φ = 1.618...
      confidence:  PSI,                  // ψ = 0.618
      coherence:   CSL_THRESHOLDS.HIGH,  // 0.882
      cycle_ms:    AUTO_SUCCESS_CYCLE_MS, // 29034 ms
    }},
    timestamp: new Date().toISOString(),
  }});
}});

/**
 * POST /process
 * Primary service endpoint. Executes within an OTLP-traced span
 * with phi-context attributes attached.
 */
app.post(\'/process\', async (req, res, next) => {{
  const start = Date.now();
  metrics.requestCounter.add(1, {{ service: SERVICE_NAME }});

  try {{
    const result = await headySpan(tracer, `${{SERVICE_NAME}}.process`, {{
      confidence: PSI,
      coherence:  CSL_THRESHOLDS.HIGH,
      domain:     req.headyDomain ?? config.domain,
      pipelineStage: req.body?.stage ?? \'unknown\',
    }}, async (span) => {{
      // ── Service-specific logic ──────────────────────────────────────
      const input = req.body ?? {{}};

      // Validate input CSL confidence gate
      const inputConfidence = input.confidence ?? PSI;
      if (inputConfidence < CSL_THRESHOLDS.PASS) {{
        const err = new Error(`Input confidence ${{inputConfidence.toFixed(3)}} below CSL gate ψ = ${{PSI.toFixed(3)}}`);
        err.status = 422;
        throw err;
      }}

      // Service-specific processing goes here
      const output = {{
        service:    SERVICE_NAME,
        input_keys: Object.keys(input),
        processed:  true,
        confidence: PSI,
        domain:     config.domain,
      }};

      span.setAttribute(\'heady.output.keys\', Object.keys(output).join(\',\'));
      return output;
    }});

    const latencyMs = Date.now() - start;
    metrics.latencyHistogram.record(latencyMs, {{ service: SERVICE_NAME }});

    res.json({{
      success: true,
      data: result,
      latency_ms: latencyMs,
      phi_context: {{ confidence: PSI, domain: config.domain }},
    }});
  }} catch (err) {{
    next(err);
  }}
}});

// ─── ERROR HANDLER (last middleware, after all routes) ───────────────────────

app.use(headyErrorHandler(logger));

// ─── SERVER STARTUP ───────────────────────────────────────────────────────────

const server = app.listen(config.port, () => {{
  logHealthEvent(logger, \'startup\', true, {{
    port: config.port,
    domain: config.domain,
    phi_cycle_ms: AUTO_SUCCESS_CYCLE_MS,
    csl_threshold: CSL_THRESHOLDS.PASS,
  }});
  logger.info({{ event: \'service.started\', port: config.port, domain: config.domain }},
    `${{SERVICE_NAME}} listening on :${{config.port}}`);
  health.markReady();
}});

// Graceful shutdown — φ⁶ × 1000 = 17,944 ms window
async function gracefulShutdown(signal) {{
  logger.info({{ event: \'service.shutdown\', signal }}, `Graceful shutdown initiated (${{signal}})`);
  const shutdownTimeout = setTimeout(() => process.exit(1), config.timeout.shutdown);

  server.close(async () => {{
    clearTimeout(shutdownTimeout);
    logger.info({{ event: \'service.shutdown.complete\' }}, `${{SERVICE_NAME}} shutdown complete`);
    process.exit(0);
  }});
}}

process.on(\'SIGTERM\', () => gracefulShutdown(\'SIGTERM\'));
process.on(\'SIGINT\',  () => gracefulShutdown(\'SIGINT\'));

// Unhandled rejection safety net (Law #1: every async has error handling)
process.on(\'unhandledRejection\', (reason, promise) => {{
  logger.error({{ event: \'unhandled_rejection\', reason: String(reason) }},
    \'Unhandled Promise rejection — this is a Law #1 violation, fix immediately\');
  process.exit(1); // Force crash to trigger health check failure → restart
}});

export {{ app, server, health, config }};
'''

PACKAGE_JSON_TEMPLATE = '''{{
  "name": "@heady/{SERVICE_ID}",
  "version": "3.2.3",
  "description": "{SERVICE_DESC}",
  "type": "module",
  "main": "./src/index.js",
  "scripts": {{
    "start": "node --experimental-vm-modules src/index.js",
    "dev":   "node --watch --experimental-vm-modules src/index.js",
    "test":  "vitest run"
  }},
  "dependencies": {{
    "@heady/platform": "workspace:*",
    "express": "^4.21.1"
  }},
  "devDependencies": {{
    "vitest": "^2.1.8"
  }},
  "engines": {{
    "node": ">=20.0.0"
  }},
  "private": true,
  "author": "Eric Haywood <eric@headyconnection.org>",
  "license": "UNLICENSED"
}}
'''

DOCKERFILE_TEMPLATE = '''# ─────────────────────────────────────────────────────────────
# {SERVICE_ID} — Production Dockerfile
# Multi-stage build. Workspace-aware, container-ready, zero localhost references.
# All runtime config from environment variables (Law #5).
# ─────────────────────────────────────────────────────────────

FROM node:22-alpine AS base
WORKDIR /app

# Install workspace dependencies for the shared platform and target service.
COPY package.json ./
COPY packages/platform/package.json ./packages/platform/
COPY services/{SERVICE_ID}/package.json ./services/{SERVICE_ID}/
RUN npm install --workspace=packages/platform --workspace=services/{SERVICE_ID} --omit=dev

# Copy source into the same workspace layout used at runtime.
FROM base AS build
COPY packages/platform/src ./packages/platform/src
COPY services/{SERVICE_ID}/src ./services/{SERVICE_ID}/src

# Production image
FROM base AS production
COPY --from=build /app/packages/platform/src ./packages/platform/src
COPY --from=build /app/services/{SERVICE_ID}/src ./services/{SERVICE_ID}/src

ENV NODE_ENV=production
ENV SERVICE_NAME={SERVICE_ID}
ENV PORT={PORT}

EXPOSE {PORT}
# Prometheus metrics
EXPOSE 9464

HEALTHCHECK --interval=7s --timeout=4s --start-period=30s --retries=3 \\
  CMD wget -qO- http://0.0.0.0:{PORT}/health/live || exit 1

USER node
CMD ["node", "services/{SERVICE_ID}/src/index.js"]
'''

MANIFEST_TEMPLATE = '''# ──────────────────────────────────────────────────────────────────────────────
# {SERVICE_ID} — Kubernetes + Envoy Service Manifest
# Domain: {DOMAIN} | Port: {PORT}
# CSL routing: domain matching via cosine similarity
# Concurrent-equals routing — phi-scaled CSL matching only
# ──────────────────────────────────────────────────────────────────────────────

apiVersion: v1
kind: Namespace
metadata:
  name: heady-system
  labels:
    app.kubernetes.io/part-of: heady-platform
    istio-injection: enabled

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {SERVICE_ID}
  namespace: heady-system
  labels:
    app: {SERVICE_ID}
    heady.domain: {DOMAIN_LABEL}
    version: "3.2.3"
    app.kubernetes.io/part-of: heady-platform
spec:
  replicas: 3                   # F(4) = 3
  selector:
    matchLabels:
      app: {SERVICE_ID}
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge:        2        # F(3) = 2
      maxUnavailable:  1        # F(2) = 1
  template:
    metadata:
      labels:
        app: {SERVICE_ID}
        heady.domain: {DOMAIN_LABEL}
        version: "3.2.3"
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port:   "9464"
        prometheus.io/path:   "/metrics"
    spec:
      serviceAccountName: {SERVICE_ID}-sa
      containers:
        - name: {SERVICE_ID}
          image: us-central1-docker.pkg.dev/heady-prod/{SERVICE_ID}:3.2.3
          imagePullPolicy: Always
          ports:
            - containerPort: {PORT}
              name: http
              protocol: TCP
            - containerPort: 9464
              name: metrics
              protocol: TCP
          env:
            - name:  NODE_ENV
              value: production
            - name:  SERVICE_NAME
              value: {SERVICE_ID}
            - name:  SERVICE_VERSION
              value: "3.2.3"
            - name:  HEADY_DOMAIN
              value: {DOMAIN}
            - name:  PORT
              value: "{PORT}"
            - name:  OTEL_EXPORTER_OTLP_ENDPOINT
              value: "http://heady-collector.heady-system.svc.cluster.local:4317"
            - name:  OTEL_SERVICE_NAME
              value: {SERVICE_ID}
            - name:  CSL_CONFIDENCE
              value: "0.618"
            - name:  CSL_COHERENCE
              value: "0.882"
            - name:  MTLS_ENABLED
              value: "true"
          envFrom:
            - secretRef:
                name: {SERVICE_ID}-secrets
                optional: true
          livenessProbe:
            httpGet:
              path: /health/live
              port: http
            initialDelaySeconds: 5
            periodSeconds: 7        # ≈ φ⁴ = 6.854s
            timeoutSeconds: 4       # ≈ φ³ = 4.236s
            failureThreshold: 3     # F(4) = 3
          readinessProbe:
            httpGet:
              path: /health/ready
              port: http
            initialDelaySeconds: 3
            periodSeconds: 7
            timeoutSeconds: 4
            failureThreshold: 3
          startupProbe:
            httpGet:
              path: /health/startup
              port: http
            failureThreshold: 13    # F(7) = 13 (longer for slow-starting services)
            periodSeconds: 5        # F(5) = 5
          resources:
            requests:
              memory: "89Mi"        # F(11) = 89
              cpu:    "55m"         # F(10) = 55
            limits:
              memory: "377Mi"       # F(14) = 377
              cpu:    "233m"        # F(13) = 233

---
apiVersion: v1
kind: Service
metadata:
  name: {SERVICE_ID}
  namespace: heady-system
  labels:
    app: {SERVICE_ID}
    heady.domain: {DOMAIN_LABEL}
spec:
  selector:
    app: {SERVICE_ID}
  ports:
    - name: http
      protocol: TCP
      port: {PORT}
      targetPort: http
    - name: metrics
      protocol: TCP
      port: 9464
      targetPort: metrics
  type: ClusterIP

---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: {SERVICE_ID}-sa
  namespace: heady-system

---
# PeerAuthentication — enforce mTLS for ALL traffic to this service
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: {SERVICE_ID}-peer-auth
  namespace: heady-system
spec:
  selector:
    matchLabels:
      app: {SERVICE_ID}
  mtls:
    mode: STRICT

---
# AuthorizationPolicy — zero-trust service-to-service rules
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: {SERVICE_ID}-authz
  namespace: heady-system
spec:
  selector:
    matchLabels:
      app: {SERVICE_ID}
  action: ALLOW
  rules:
    - from:
        - source:
            principals:
              - "cluster.local/ns/heady-system/sa/heady-manager-sa"
              - "cluster.local/ns/heady-system/sa/heady-gateway-sa"
              - "cluster.local/ns/heady-system/sa/{SERVICE_ID}-sa"
      to:
        - operation:
            ports: ["{PORT}"]

---
# HorizontalPodAutoscaler — Fibonacci-snapped replica counts
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {SERVICE_ID}-hpa
  namespace: heady-system
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {SERVICE_ID}
  minReplicas: 2    # F(3) = 2
  maxReplicas: 13   # F(7) = 13
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 62   # ≈ ψ × 100 = 61.8%
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 62

---
# VirtualService — CSL routing without ranking fields
# Traffic routing based on CSL domain header matching
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: {SERVICE_ID}-vs
  namespace: heady-system
spec:
  hosts:
    - {SERVICE_ID}.heady-system.svc.cluster.local
  http:
    - match:
        - headers:
            x-heady-domain:
              exact: {DOMAIN}
        - headers:
            x-heady-service:
              exact: {SERVICE_ID}
      route:
        - destination:
            host: {SERVICE_ID}
            port:
              number: {PORT}
      timeout: 11s       # ≈ φ⁵ = 11.090s
      retries:
        attempts: 3      # F(4) = 3
        perTryTimeout: 4s
        retryOn: "5xx,reset,connect-failure,retriable-4xx"
    - route:
        - destination:
            host: {SERVICE_ID}
            port:
              number: {PORT}
'''

def make_upstream_checks(service):
    """Generate upstream health check registrations."""
    lines = []
    for ups in service.get("upstreams", []):
        env_var = ups.upper().replace("-", "_") + "_URL"
        lines.append(f"// Upstream: {ups}")
        lines.append(f"health.register('{ups}', async () => {{")
        lines.append(f"  const url = process.env['{env_var}'];")
        lines.append(f"  if (!url) return {{ status: 'degraded', message: 'Env var {env_var} not set' }};")
        lines.append(f"  try {{")
        lines.append(f"    const controller = new AbortController();")
        lines.append(f"    const t = setTimeout(() => controller.abort(), TIMEOUTS.PHI_3);")
        lines.append(f"    const r = await fetch(`${{url}}/health/live`, {{ signal: controller.signal }});")
        lines.append(f"    clearTimeout(t);")
        lines.append(f"    return {{ status: r.ok ? 'healthy' : 'degraded', message: `{ups} returned ${{r.status}}` }};")
        lines.append(f"  }} catch (err) {{")
        lines.append(f"    return {{ status: 'unhealthy', message: err.message }};")
        lines.append(f"  }}")
        lines.append(f"}});")
        lines.append("")
    return "\n".join(lines)

def make_domain_label(domain):
    return domain.replace(".", "-").replace("/", "-")

created = 0
for svc in SERVICES:
    svc_dir = f"{SERVICES_DIR}/{svc['id']}/src"
    os.makedirs(svc_dir, exist_ok=True)

    upstreams_str = ", ".join(svc['upstreams']) if svc['upstreams'] else "none"

    # Write index.js
    src = SERVICE_TEMPLATE.format(
        SERVICE_ID=svc['id'],
        SERVICE_DESC=svc['desc'][:70],
        DOMAIN=svc['domain'],
        PORT=svc['port'],
        UPSTREAMS=upstreams_str,
        UPSTREAM_CHECKS=make_upstream_checks(svc),
    )
    with open(f"{SERVICES_DIR}/{svc['id']}/src/index.js", "w") as f:
        f.write(src)

    # Write package.json
    pkg = PACKAGE_JSON_TEMPLATE.format(
        SERVICE_ID=svc['id'],
        SERVICE_DESC=svc['desc'],
    )
    with open(f"{SERVICES_DIR}/{svc['id']}/package.json", "w") as f:
        f.write(pkg)

    # Write Dockerfile
    docker = DOCKERFILE_TEMPLATE.format(
        SERVICE_ID=svc['id'],
        PORT=svc['port'],
        DOMAIN=svc['domain'],
    )
    with open(f"{SERVICES_DIR}/{svc['id']}/Dockerfile", "w") as f:
        f.write(docker)

    # Write Kubernetes manifest
    manifest = MANIFEST_TEMPLATE.format(
        SERVICE_ID=svc['id'],
        DOMAIN=svc['domain'],
        DOMAIN_LABEL=make_domain_label(svc['domain']),
        PORT=svc['port'],
    )
    with open(f"{SERVICES_DIR}/{svc['id']}/{svc['id']}.manifest.yaml", "w") as f:
        f.write(manifest)

    created += 1

print(f"Created {created} services")

# Write service index
index = {
    "version": "3.2.3",
    "generated": "2026-03-09",
    "service_count": len(SERVICES),
    "phi": 1.6180339887498948,
    "csl_threshold": 0.618,
    "services": [
        {
            "id": s["id"],
            "port": s["port"],
            "domain": s["domain"],
            "description": s["desc"],
            "upstreams": s["upstreams"],
            "health_endpoints": [
                f"http://{s['id']}:{s['port']}/health",
                f"http://{s['id']}:{s['port']}/health/live",
                f"http://{s['id']}:{s['port']}/health/ready",
                f"http://{s['id']}:{s['port']}/health/startup",
                f"http://{s['id']}:{s['port']}/health/details",
            ]
        }
        for s in SERVICES
    ]
}

with open(f"{BASE}/services/SERVICE_INDEX.json", "w") as f:
    json.dump(index, f, indent=2)

print(f"Service index written to services/SERVICE_INDEX.json")
