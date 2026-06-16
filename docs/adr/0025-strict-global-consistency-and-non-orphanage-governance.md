# ADR-0025: Strict Global Consistency and Non-Orphanage Governance

- **Status:** Accepted (2026-06-16)
- **Deciders:** Eric Anthony Haywood

## Context

The legacy Heady codebase suffered from significant "data rot," projection drift, and orphan proliferation. Files, variables, microservices, and database columns existed in various states of detachment, leading to silent failures, security holes, and a massive accumulation of technical debt (~372 packages collapsing to ~100 active components). To build a fully autonomous operating loop safely, we must enforce a zero-tolerance policy against disconnected, dead, or orphaned artifacts.

## Decision

1. **Zero Codebase Changes Without Verification**: No pull requests, commits, or deployments are approved unless the workspace is proven to be 100% consistent and fully connected.
2. **Orphan File Prevention**: Every file in the monorepo must reside in a recognized directory tree defined in `tooling/skeleton-guard/skeleton.json`. The CI pipeline runs `verify-placement` and `audit-orphans` on every run, blocking builds on unrecognized files.
3. **Orphan Export and Dead Code Elimination**: Every exported function, class, variable, or type must either be imported and used within the monorepo or explicitly defined as a public API in the OpenAPI spec (`packages/contracts`). Standard static checkers (such as `knip`) will run in CI to fail builds on unused exports or dead code.
4. **Data and Schema Connectivity**: Every database column (Neon), cache namespace (Redis), and event topic (NATS) must be mapped to an active publisher and consumer. Disconnected database schemas or unsubscribed event topics are treated as technical debt and block build approval.
5. **Continuous Consistency Loop**: The Continuous Consistency Engine (CCE) executes fact checks (`check-facts`) and dependency scans (`dependency-cruiser`) on every pre-commit hook and CI run, failing the build on any detected data or module disconnect.

## Consequences

- (+) Guarantees that the codebase remains completely clean and understandable for autonomous coding agents.
- (+) Eliminates silent bugs caused by dead code execution or orphaned configuration variables.
- (+) Prevents secret leaks, zombie microservices, and projection drift.
- (−) Increases strictness of local pre-commits and CI pipeline execution time (mitigated by Turborepo caching).
- (−) Unused experimental code must be deleted or explicitly marked in configuration, rather than left commented out or orphaned in the workspace.
