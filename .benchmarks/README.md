# Heady Benchmark Suite

Reproducible latency benchmarks for the Heady Cloud Run service fleet.
Created to validate the **<50ms p99 latency** claim ahead of investor due diligence.

## Prerequisites

1. **k6** — Install from https://k6.io/docs/getting-started/installation/
   ```bash
   # macOS
   brew install k6

   # Linux (Debian/Ubuntu)
   sudo gpg -k
   sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
     --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D68
   echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
     | sudo tee /etc/apt/sources.list.d/k6.list
   sudo apt-get update && sudo apt-get install k6

   # Docker
   docker run --rm -i grafana/k6 run - <script.js
   ```

2. **Network access** to Cloud Run endpoints (authenticated or public health paths).

3. **GCP credentials** (optional) — If services require auth, set:
   ```bash
   export HEADY_AUTH_TOKEN=$(gcloud auth print-identity-token)
   ```

## Running Benchmarks

### Quick — Run Everything
```bash
chmod +x run-benchmarks.sh
./run-benchmarks.sh
```

### Individual Scripts

#### Health Check Latency (all 21 Cloud Run services)
```bash
k6 run k6-health-check.js
```

#### MCP Tool Response Times (6 tool groups)
```bash
k6 run k6-mcp-tools.js
```

### With Authentication
```bash
HEADY_AUTH_TOKEN=$(gcloud auth print-identity-token) k6 run k6-health-check.js
```

### Override Base URL
```bash
BASE_URL=https://my-staging-instance.run.app k6 run k6-health-check.js
```

## Output

Results are written to `.benchmarks/results/` as JSON summary files:
- `results/health-check-YYYY-MM-DDTHH-MM-SS.json`
- `results/mcp-tools-YYYY-MM-DDTHH-MM-SS.json`
- `results/summary.txt` — Human-readable combined report

## Thresholds

All thresholds derive from phi-mathematics (phi = 1.618033988749895):

| Metric | Threshold | Derivation |
|--------|-----------|------------|
| Health endpoint p99 | < 50ms | Edge-servable claim (Cloudflare Workers sub-10ms + origin round-trip) |
| Health endpoint p95 | < 34ms | FIB[8] = 34 |
| Health endpoint p50 | < 21ms | FIB[7] = 21 |
| Cognitive endpoint p99 | < 1618ms | phi * 1000, rounded |
| Cognitive endpoint p95 | < 987ms | FIB[16] = 987 |
| MCP tool p99 | < 1618ms | phi * 1000 |
| MCP tool p95 | < 987ms | FIB[16] |
| Error rate | < 1% | Production SLA floor |

## Service Fleet

The benchmark covers all 21 Cloud Run services across 3 tiers:

### HOT (always-on, min-instances >= 1)
- heady-brain, heady-soul, heady-memory, heady-conductor, api-gateway, auth-session

### WARM (scale-to-zero, startup-cpu-boost)
- search, mcp-server, heady-buddy, heady-web, notification

### COLD (batch jobs)
- auto-success-engine, hcfullpipeline-executor

### Service Catalog (configs/service-catalog.yaml)
- domain-router, observability-kernel, budget-tracker, heady-health
- heady-brains, heady-governance, heady-guard, heady-autobiographer, heady-bee-factory

## Interpreting Results

A passing benchmark means:
1. All 21 health endpoints respond within phi-derived thresholds
2. MCP tool invocations complete within cognitive latency budget
3. Error rate stays below 1% under 100 VU sustained load

A failing benchmark identifies:
- Which services exceed the <50ms p99 health claim
- Cold-start impact on WARM/COLD tier services
- Network path latency from the benchmark runner to us-east1
