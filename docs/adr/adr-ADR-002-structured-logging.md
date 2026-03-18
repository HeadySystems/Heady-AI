# ADR-002: Structured JSON Logging

**Status:** Accepted  
**Date:** 2026-03-09

## Context
The codebase uses ~1000+ `console.log` calls with no structure, making log aggregation and alerting impossible.

## Decision
Created `packages/shared/structured-logger.js` with:
- JSON output for Cloud Logging compatibility
- Level-based filtering (TRACE→FATAL)
- Sensitive field redaction
- φ-sampled logging for high-volume paths (Fibonacci intervals)
- Child loggers with module context

## Consequences
- All new code must use `getLogger()` instead of `console.log`
- Existing `console.log` calls migrated incrementally
- Cloud Logging can now parse, filter, and alert on structured fields
