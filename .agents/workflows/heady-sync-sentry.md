---
description: Synchronize Sentry error tracks to Linear via the Neon cache system
---

> Transferred 2026-08-09 from ~/.agents/workflows during the rebuild command consolidation.

# /heady-sync-sentry

This workflow synchronizes Sentry error tracks to Linear via the Neon cache system.

## 1. Extract Errors
- Query the Sentry API to gather the latest unresolved error tracks.

## 2. Sync to Neon Cache
- Update the Heady PostgreSQL + pgvector Neon database with the error details.

## 3. Create Linear Issues
- Convert the cached errors into GraphQL mutations.
- Sync them to Linear, assigning to the appropriate Heady node or team member.
- Confirm successful creation without using hardcoded tokens (ensure HeadyVault usage).
