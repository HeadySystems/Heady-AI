# Changelog

All notable changes to the Heady AI Platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [3.0.0] — 2026-02-24

### 🚀 Production Go-Live

- **PRODUCTION-LIVE** state achieved
- 20 AI intelligence nodes fully operational
- HeadySwarm + HeadyBees autonomous task completion fleet active
- HCFP Auto-Success Pipeline running continuously
- All 19 branded sites deployed via Cloudflare tunnel

### Added

- Federated Liquid Routing via HeadyConductor
- Post-Quantum Cryptography (ML-KEM + ML-DSA) for all mesh traffic
- DuckDB Vector Memory V2 with HNSW indexing
- Arena Mode (HeadyBattle) — multi-node competitive response selection
- HeadySwarm bio-inspired task scheduling with waggle dance recruitment
- Heady Hive SDK (`heady-hive-sdk`) — CLI and npm package
- MCP Server with 40+ specialized tools
- 3 Hugging Face Spaces (HeadyBrain, HeadySystems, HeadyConnection)

### Changed

- Migrated all domains from `heady.io` to `headyio.com`
- Consolidated documentation from 71+ stale files to 7 clean canonical guides
- Upgraded rate limiter with in-memory fallback when Redis unavailable
- MCP server defaults to localhost:3301 (bypasses edge mTLS for local use)

### Fixed

- HeadyManager crash loop (ESM/CJS conflict + missing ioredis fallback)
- HCFP auto-success shebang syntax error
- MCP mTLS authentication error when connecting locally

### Security

- PQC hybrid signatures enforced on all inter-service communication
- 24-hour automated secret rotation
- Rate limiting with auto-ban (120 req/min Pro, 30 req/min Free)
- V8 Bytecode + AST obfuscation for production builds

## [2.0.0] — 2025-12-01

### Added

- Initial Sacred Geometry architecture
- HeadyBrain core reasoning engine
- Basic MCP server integration

## [1.0.0] — 2025-06-01

### Added

- Project inception
- Initial prototype with single AI model
