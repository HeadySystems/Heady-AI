# ADR-0026: MCP Console (Admin UI) Architecture

- **Status:** Accepted (2026-06-16)
- **Deciders:** Eric Anthony Haywood

## Context

We require a centralized dashboard to orchestrate, monitor, and control all 15 connectors (1 core MCP server, 9 projection shells, and 5 infrastructure providers). This console is an internal-first engineering tool (`headyme-portal`) that must be deployed to our verified domain to unblock the Google for Startups suspension and restore our GCP credits. The UI needs to be lightweight, responsive, and provide real-time status visibility without adding framework overhead.

## Decision

1. **Vanilla Web Components**: The Console UI will be built entirely using Vanilla Web Components (HTML5/CSS3/Vanilla JS) rather than React or Vue, except for complex 3D visualizers where React is permitted. This prevents compilation bloat.
2. **Server-Sent Events (SSE) Sync**: Unilateral state changes (health updates, logs, metrics) will stream from the origin to the client via Server-Sent Events (SSE) + HTTP/2, rather than WebSockets, to minimize connection overhead.
3. **The Honeycomb Layout**: Connectors will be rendered in a responsive, gyroscopic hex-grid layout. Each cell represents a connector and uses CSS variables and SVG animations to indicate state:
   * `#00d4aa` (Teal) for healthy connections.
   * `#7c5eff` (Violet) for degraded or projection-only nodes.
   * Amber/Yellow for expired tokens.
4. **First-Class Token Expired State**: OAuth token expiration is handled as an active state. The honeycomb cell will render an inline, one-tap "Re-authorize" button redirecting to the auth domain rather than failing silently or returning general HTTP errors.
5. **Periodic Probing**: Probes will query the connector registry every $\phi^7 \times 1000 \approx 29,034$ milliseconds (our golden heartbeat) to sync the active manifest.

## Consequences

- (+) Instant load times and zero framework update overhead.
- (+) Eliminates projection drift: the Console queries each shell directly, reflecting the actual state.
- (+) Simple and clear visualization of system dependencies.
- (−) Hex-grid rendering requires manual CSS/SVG layout math compared to flex/grid wrappers.
- (−) SSE is unidirectional; active actions (like re-authorizing) require separate HTTP POST requests.
