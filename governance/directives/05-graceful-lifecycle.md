<!-- HEADY_BRAND:BEGIN
  HEADY™ · MASTER DIRECTIVE 5 — DIRECTIVE 5: GRACEFUL LIFECYCLE MANAGEMENT
  LAYER: root · scope: GLOBAL_PERMANENT · enforcement: MANDATORY
  ∞ Sacred Geometry · Liquid Intelligence ∞
  Made with ❤️ by HeadySystems Inc.
HEADY_BRAND:END -->

# DIRECTIVE 5: GRACEFUL LIFECYCLE MANAGEMENT

## Purpose
Every process, bee, card, connection has a lifecycle: born, runs, dies gracefully. No zombies, no leaked
resources, no orphaned connections. Clean baseline after every operation.

## Lifecycle Phases
`SPAWN → INITIALIZE → READY → ACTIVE → DRAINING → SHUTDOWN → DEAD`
(register/allocate → load config/connect/validate env → health passed/accepting → processing/heartbeats →
stop new work, finish in-flight → release resources → remove from registry)

## Resource Cleanup Guarantees
exit-hook for stdout/stderr flush · sockets closed with FIN · MIDI ports released · DB connections
returned to pool · file handles closed even on error paths · timers/intervals cleared · child processes
SIGTERM→5s→SIGKILL · temp files deleted.

## Bee Lifecycle at Scale (Constitution Law 6)
Pre-warmed pools 5-8-13-21 (Fibonacci) · scale-up when `queue_depth > pool × φ` · scale-down when idle
bees > `pool × (1 − 1/φ)` for >60s · stale detection: no heartbeat 60s → dead → respawn · graceful
shutdown via cooperative cancellation → drain → checkpoint → die.

---
*Heady™ — HeadySystems Inc. — Implements the Constitution (`governance/CONSTITUTION.md`).*
