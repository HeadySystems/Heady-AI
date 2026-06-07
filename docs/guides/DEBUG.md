<!-- HEADY_BRAND:BEGIN
<!-- ╔══════════════════════════════════════════════════════════════════╗
<!-- ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
<!-- ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
<!-- ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
<!-- ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
<!-- ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
<!-- ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
<!-- ║                                                                  ║
<!-- ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
<!-- ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
<!-- ║  FILE: docs/guides/DEBUG.md                                                    ║
<!-- ║  LAYER: docs                                                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
# Heady Debug Guide

## General Debugging

### Health Check All Services
```bash
for port in 3310 3311 3312 3313 3314 3315 3316 3317 3380 3381 3382 3383 3384 3385 3386 3390 3391 3392 3393 3394; do
  echo "Port $port: $(curl -s http://localhost:$port/health | jq -r '.status // "UNREACHABLE"')"
done
```

### Error Lookup
```bash
# Look up a specific error
curl http://localhost:3385/errors/lookup?code=AUTH_1001

# Get error analytics
curl http://localhost:3385/errors/analytics
```

### Common Issues

#### AUTH_1001: Session Expired
- Session TTL is 1597 seconds (≈26.6 minutes)
- Check if token rotation is working (sliding window in last 377 seconds)
- Verify device fingerprint hasn't changed

#### AUTH_1003: Device Fingerprint Mismatch
- User's IP or User-Agent changed mid-session
- Common with VPN switching or browser updates
- Resolution: force re-authentication

#### API_2003: Service Unavailable
- Check Docker container status
- Check circuit breaker state in service mesh
- Review resource allocation (Fibonacci-scaled limits)

#### AGENT_5001: Coherence Drift
- Agent's embedding has drifted from expected position
- Check vector memory for the agent state
- Re-embed the agent and verify against HeadySoul

#### DATA_3003: Vector Index Degraded
- HNSW index may need rebuild
- Check efSearch (should be 89) and m (should be 21)
- Rebuild: `POST /migration/vector-index { table, column, dimensions: 384, indexType: "hnsw" }`

## φ-Math Debugging
```javascript
// Verify a constant is φ-derived
import { PHI, PSI, fibonacci, phiThreshold } from './shared/phi-math-v2.js';

// Check if value is Fibonacci
const isFib = (n) => { let a=1,b=1; while(b<n){[a,b]=[b,a+b];} return b===n||n===1; };

// Check if value is φ-derived
const isPhiDerived = (v) => Math.abs(v - PHI) < 0.01 || Math.abs(v - PSI) < 0.01 || isFib(v);
```

## CSL Gate Debugging
```javascript
// Inspect gate behavior
import { cslGate } from './shared/csl-engine-v2.js';
const PSI3 = 0.236; // ψ³

// Test various scores against a threshold
for (let score = 0; score <= 1; score += 0.1) {
  console.log('score=' + score.toFixed(1) + ' → gate=' + cslGate(1.0, score, 0.809, PSI3).toFixed(4));
}
```
