   # ADR-005: Sacred Geometry Constants

   **Status:** Accepted
   **Date:** 2026-01-15
   **Author:** Eric Haywood
   **Heady Systems Inc. — Sacred Geometry v4.0**

   ## Problem

   How to derive all numeric constants in the system

   ## Decision

   Every number derives from phi (1.618), psi (0.618), or Fibonacci sequence

   ## Consequences

- Zero magic numbers anywhere in codebase
- Cache sizes: Fibonacci (34, 55, 89, 144, 233, 377, 987)
- Timeouts: phi-scaled (1618ms, 2618ms, 4236ms, 6854ms)
- Rate limits: Fibonacci (55/min anonymous, 144/min auth, 233/min enterprise)
- Pool allocation: phi-resource weights (34% hot, 21% warm, 13% cold, 8% reserve, 5% governance)
- Backoff: phi-exponential (base * PHI^attempt with ±38.2% jitter)
- This is not aesthetic — it provides mathematically optimal distribution properties

   ---
   *© 2026 HeadySystems Inc. — 51 Provisional Patents*
