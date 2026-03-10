# Changelog — Heady Platform

All notable changes to this project will be documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.0.0] — Sacred Genesis — 2026-03-10

### Added
- Complete platform rebuild from first principles
- 60 microservices with health probes, structured logging, phi-scaled middleware
- 9 website frontends with Sacred Geometry CSS, JSON-LD, WCAG 2.1 AA
- Shared phi-math foundation (912 lines) — all constants derive from phi/Fibonacci
- CSL engine with AND, OR, NOT, IMPLY, XOR, CONSENSUS, GATE operations
- Sacred Geometry orchestration topology with 5-ring node placement
- Circuit breaker with phi-exponential backoff and bulkhead isolation
- Saga orchestrator for multi-service distributed transactions
- Event store with CQRS bus pattern for event-sourced architecture
- Auto-Success Engine with phi^7-derived cycle (29,034ms)
- Bee Factory for dynamic agent worker spawning (30+ bee types)
- Multi-provider embedding router (Nomic, Jina, Cohere, Voyage, Ollama)
- Hybrid vector search (BM25 + dense + SPLADE) with RRF fusion
- MCP gateway with CSL-gated routing and WASM sandboxing
- Session server with httpOnly cookies and CSRF protection
- RBAC with phi-derived role hierarchy (5 roles, 30+ permissions)
- Security middleware (CSP, rate limiter, CORS)
- Vault client with AES-256-GCM envelope encryption
- WebSocket authentication with rate limiting
- Audit logger with Merkle tree chain verification
- Prometheus + Grafana monitoring with phi-derived alert thresholds
- NATS JetStream event bridge
- PgBouncer connection pooling with Fibonacci-sized pools
- Schema registry with backward compatibility checking
- Feature flags service with Fibonacci-stepped rollout
- CI/CD pipeline (GitHub Actions) with security scanning
- Nginx reverse proxy with structured JSON logging
- 8 Architecture Decision Records (ADRs)
- 4 operational runbooks (service recovery, deployment, monitoring, database)
- Error catalog with 50+ standardized error codes
- 3 C4 architecture diagrams (System Context, Container, Component)
- Developer onboarding guide
- Debug guide with diagnostic procedures
- Hardened Dockerfile with multi-stage build, non-root user
- Container security scanning script

### Architecture
- Edge: Cloudflare Workers + Durable Objects + Pages
- Origin: Google Cloud Run (us-east1)
- Database: PostgreSQL 16 + pgvector with HNSW indexes
- Messaging: NATS JetStream
- Monitoring: Prometheus + Grafana + Alertmanager
- CDN: Cloudflare
- CI/CD: GitHub Actions

### Security
- httpOnly cookie sessions (ZERO localStorage tokens)
- CSRF double-submit cookie protection
- Content Security Policy with strict-dynamic
- Mutual TLS for service-to-service
- AES-256-GCM secret encryption
- Post-quantum cryptography preparation (ML-KEM/X25519)
- Append-only Merkle tree audit trail
- WASM sandbox for MCP tool execution

### Constants
- phi = 1.6180339887498948
- psi = 0.6180339887498948
- Auto-Success cycle: phi^7 * 1000 = 29,034ms
- Pool ratios: Hot 34%, Warm 21%, Cold 13%, Reserve 8%, Governance 5%
- Service ports: 3310-3369 (core), 3370-3373 (infrastructure)
