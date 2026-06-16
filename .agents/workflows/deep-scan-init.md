---
description: Enforce deep-scan and deep-research at the start of every task to establish full codebase context before implementation work.
---

> **OPTIMAL BUILD NOTICE:** This file has been auto-migrated for the Heady-AI Latent OS (v2.0.0).
> - **Package Manager:** Use `pnpm` and `Turborepo`
> - **Frontend:** Vite SPAs + Vanilla Web Components (React only for complex canvas)
> - **Event Bus:** NATS (`heady-event-bus`)
> - **Sandbox:** WASM WebContainers
> - **UI Sync:** Server-Sent Events (SSE) + HTTP/2
> - **Vector Trigger:** Merkle-Tree File Hashing
> - **Rule File:** Follow `AGENTS.md`

# Deep-Scan Task Initialization Workflow

**Every task MUST begin with deep-scan and deep-research to establish full context.**

## Steps

### 1. Deep-Scan the Codebase

// turbo
Run the deep-scan skill against the project root to map the entire workspace into 3D vector memory:

```
Read the deep-scan skill at:
/home/headyme/Heady-AI/.agents/skills/heady-deep-scan/SKILL.md
```

Then analyze the relevant project area:

- Review all files in the target directory
- Map function signatures, class hierarchies, module dependencies
- Check vector-memory.js for any pipeline gaps (embedding → projection flow)
- Verify bee modules in /src/bees/ are all registered and active

### 2. Deep-Research via Perplexity

// turbo
Use the heady-research skill (Perplexity Sonar Pro) for any external context needed:

```
Read the research skill at:
/home/headyme/Heady-AI/.agents/skills/heady-research/SKILL.md
```

Research topics should include:

- Latest best practices for the technology being modified
- Security advisories for dependencies being touched
- Competitive landscape updates if relevant

### 3. Context Verification

// turbo
After scanning, verify the context was captured:

- Query vector memory for the target area
- Confirm the relationship graph connects to relevant modules
- Validate that the embedding → projection pipeline is functioning (trackAccess is wired, smartIngest is used, zone distribution is healthy)

### 4. Proceed with Task

Only after deep-scan and deep-research are complete, proceed with the actual implementation task.

## Key Checks During Every Deep-Scan

- [ ] `trackAccess()` is called in `queryMemory()` (frequency scoring)
- [ ] All ingest paths use `smartIngest()` not raw `ingestMemory()`
- [ ] Zone distribution is balanced (no zone has >60% of vectors)
- [ ] Embedding source is remote, not local hash fallback
- [ ] API endpoints return real JSON data, not HTML or error pages
