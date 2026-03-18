# Heady System Architecture

## Overview

Heady is a personal AI platform functioning as a fully automated digital company.
It orchestrates 20+ specialized AI services across reasoning, building, validation,
creation, and operations.

## Core Principles

1. **Fractal Self-Similarity** — Same values at every scale (code → service → org)
2. **Sacred Geometry** — Fibonacci spacing, golden ratio rhythms (φ = 1.618...)
3. **Liquid Architecture** — Dynamic allocation, always-on critical paths
4. **Self-Healing** — 6-signal drift detection, Monte Carlo validation
5. **Learning from Failure** — Errors are data, not disasters

## Data Flow

```
User Request
    ↓
AI Gateway (Auth + Rate Limit)
    ↓
HeadyBrain (Primary Reasoning)
    ↓
HeadySoul (Alignment Check)
    ↓
HeadyBattle (Quality Gate)
    ↓
HeadySims (Monte Carlo Validation)
    ↓
Arena Mode (A/B Evaluation) [optional]
    ↓
HeadyVinci (Pattern Learning)
    ↓
Response to User
```

## Auto-Success Engine

Runs 135 tasks across 9 categories every 30 seconds:

| Category | Tasks |
|---|---|
| Health Checks | 18 |
| Memory Consolidation | 15 |
| Pattern Detection | 16 |
| Dependency Audit | 14 |
| Performance Optimization | 15 |
| Security Scan | 12 |
| Content Sync | 15 |
| Model Evaluation | 16 |
| Resource Balancing | 14 |

## Infrastructure

- **Edge**: Cloudflare Workers, KV, Pages, Tunnels, Access
- **Compute**: Google Cloud Run, Vertex AI
- **Storage**: Cloudflare KV, GCS, local file-based persistence
- **CI/CD**: GitHub Actions
- **Monitoring**: HeadyConductor (custom), structured logging (pino)
