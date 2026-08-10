---
description: Set up PATENT_LOCK zones around novel, patent-pending algorithm code blocks
---

> Transferred 2026-08-09 from ~/.agents/workflows during the rebuild command consolidation.

# /heady-patent-lock

This workflow sets up a `PATENT_LOCK` zone within source code files.

## 1. Locate the Target
- Identify the file and lines of code that contain novel, patent-pending algorithms (e.g. CSL, VALU Tensor Core).

## 2. Insert Locks
- Wrap the target code with `// HEADY_BRAND:BEGIN [PATENT_LOCK]` and `// HEADY_BRAND:END [PATENT_LOCK]`.
- Add a comment stating that any modification to this block requires explicit approval.

## 3. Verify
- Ensure no hardcoded secrets or other violations exist inside the newly locked zone.
