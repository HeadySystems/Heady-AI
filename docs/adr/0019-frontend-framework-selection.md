# ADR-0019: Frontend & UI Framework Selection

- **Status:** Accepted (2026-06-15)
- **Deciders:** Eric Anthony Haywood

## Context

The Heady ecosystem spans 12+ domains, a Web Portal, an IDE, and Chrome extensions. The `AGENTS.md` explicitly limits framework overhead: "Vanilla HTML/CSS/JS or React (when beneficial). No Vue/Angular." We evaluated Next.js, Astro, and Vite SPAs.

## Decision

1. **Vite SPAs + Vanilla Web Components** is the canonical frontend architecture for standard interfaces.
2. We prioritize raw DOM performance and zero framework overhead.
3. React is permitted strictly for complex state-heavy components (e.g., the IDE canvas, interactive data visualizations) mounted within the Vanilla shell.
4. TailwindCSS is avoided in favor of raw Vanilla CSS with Sacred Geometry tokens, unless explicitly overridden per project.

## Consequences

- (+) Maximum performance and fastest Time-to-Interactive (TTI).
- (+) Aligns with the "no magic" raw DOM rule and Liquid OS principles.
- (−) Requires more manual state management outside of React components.
- (−) Lacks out-of-the-box SSR (Server-Side Rendering) compared to Next.js.

## Reconciliation (v2, 2026-06-15)

Consistent with **R1** (dependency minimalism): vanilla + Twig + web components by default (no build
step); React/Vite only where complexity earns it (agent console, MCP console, portal). This ADR is the
canonical frontend decision; V9 Law 3's "no React ever" is **stale/non-binding**. See
`docs/compendium/11-reconciliation.md` R1 and `docs/compendium/09-infra-and-services.md` §I6/I7.
