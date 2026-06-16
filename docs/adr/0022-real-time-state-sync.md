# ADR-0022: Real-Time State & UI Sync

- **Status:** Accepted (2026-06-15)
- **Deciders:** Eric Anthony Haywood

## Context

As swarms update the 3D vector space or orchestrate builds, the user interfaces (HeadyBuddy Bridge, web portals) must reflect these changes instantly across devices.

## Decision

1. **Server-Sent Events (SSE) + HTTP/2** is the canonical protocol for unidirectional server-to-client state syncing.
2. WebSockets are avoided for general state sync to eliminate stateful connection-drop issues and sticky-session requirements across the Cloudflare Edge.
3. CRDTs (Yjs) are strictly reserved for specialized collaborative features (e.g., real-time multiplayer code editing).

## Consequences

- (+) Highly reliable streaming that traverses firewalls easily.
- (+) Plays perfectly with Cloud Run auto-scaling and Cloudflare edge caching.
- (−) Unidirectional nature requires clients to use standard REST/fetch for upstream requests.

## Reconciliation (v2, 2026-06-15)

**Scoped by direction:** **SSE + HTTP/2** is canonical for *unidirectional* server→client state sync
(dashboards, console health). **WebSocket** is reserved for the *bidirectional* agent session over the
per-session Durable Object (token streaming, approvals, terminal) — `liquid-stream`'s control+data split.
Yjs CRDTs for multiplayer editing only. No conflict once scoped by direction. See
`docs/compendium/07-transforms-midi-creative.md` §T8.
