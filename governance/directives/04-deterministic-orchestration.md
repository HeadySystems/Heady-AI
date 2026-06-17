<!-- HEADY_BRAND:BEGIN
  HEADY™ · MASTER DIRECTIVE 4 — DIRECTIVE 4: LOW-LATENCY DETERMINISTIC ORCHESTRATION
  LAYER: root · scope: GLOBAL_PERMANENT · enforcement: MANDATORY
  ∞ Sacred Geometry · Liquid Intelligence ∞
  © 2026 HeadySystems Inc. — Eric Haywood, Founder
HEADY_BRAND:END -->

# DIRECTIVE 4: LOW-LATENCY DETERMINISTIC ORCHESTRATION

## Purpose
When determinism matters — hardware control, financial ops, pipeline execution — use the fastest, most
predictable protocol. HTTP/REST is not always the answer.

## Protocol Selection Matrix
| Scenario | Protocol | Latency | Guarantee |
|---|---|---|---|
| Real-time IoT / A-V sync | MIDI → UDP | <1ms | fire-and-forget |
| Financial triggers, DB writes | MIDI → TCP | <10ms | buffered + seq ID + ACK |
| Physical gestures → LLM tools | MIDI → MCP | <50ms | CC (0-127) → JSON-RPC |
| Third-party webhooks | MIDI → API/REST | <200ms | SysEx → REST via edge proxy + mTLS |
| Cross-swarm coordination | NATS event bus | <10ms | spatial events, octant indexing |
| AI model routing | LLM Router | <100ms routing | CSL-scored selection |
| Bee task distribution | Task queue | <5ms enqueue | φ-scored priority queue |

## Determinism Requirements (Constitution Law 5)
Seeded PRNG for reproducible audit trails · CSL gate evaluation is pure vector arithmetic (no LLM in the
math path) · race conditions prevented by event ordering, not locks · eventual-consistency windows
bounded + documented per service.

---
*Heady™ — HeadySystems Inc. — Implements the Constitution (`governance/CONSTITUTION.md`).*
