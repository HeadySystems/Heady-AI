# Feature Spec: Skill Foundry for Installable Buddy/IDE/Web Action Packs

**Feature ID:** HEADY-FEAT-006  
**Domain:** headyio.com / headyme.com / headybuddy.org  
**Status:** Draft  
**Author:** Eric Haywood  
**Date:** 2026-03-17  
**Version:** 1.0

---

## 1. Problem Statement

HeadyBuddy, HeadyAI-IDE, and HeadyWeb each have fixed, predefined capabilities. Users who need specialized behavior — domain-specific reasoning patterns, custom tool chains, workflow-specific prompting strategies — have no way to extend these surfaces without custom engineering. The AI capabilities cannot be personalized at the skill level.

A "skill" in this context is a packaged, reusable unit of AI behavior: a set of instructions, prompts, tool bindings, and optional UI affordances that teach a surface how to perform a specific type of work. Without a Skill Foundry — a creation, packaging, testing, and distribution tool for skills — every capability is a one-time prompt and every power user is building the same workflows from scratch, every session.

**Who experiences this:** All Heady users who work in specialized domains (law, medicine, engineering, finance, research); developers who want to build and distribute skills; the Heady team building first-party skill packs.

**Cost of not solving it:** Shallow AI utility; no community-driven capability expansion; inability to serve vertical markets; direct competitive gap versus specialized AI tools with domain expertise built in.

---

## 2. Goals

| Goal | Measurement | Target |
|---|---|---|
| Non-technical users can create a working skill in ≤ 15 minutes | Median time to first skill creation (guided flow) | ≤ 15 minutes |
| Skills are reusable and portable across Heady surfaces | % of created skills successfully deployed to ≥ 2 surfaces | ≥ 50% |
| Developer-published skills reach users via Liquid Module Registry | Time from skill submission to user availability | ≤ 48 hours (reviewed) |
| Active skills demonstrably improve AI task quality in their domain | User-reported task quality improvement using a domain skill | ≥ 30% vs. generic Buddy |
| Skills can be shared and forked by the community | Fork rate: % of shared skills forked by at least one other user within 30 days | ≥ 20% |

---

## 3. Non-Goals

- **Not a code IDE.** Skill Foundry is a prompt-engineering and configuration tool; complex code execution requires HeadyAI-IDE.
- **Not a fine-tuning platform.** Skills inject behavior at inference time; they do not modify model weights.
- **Not an automation builder.** Skills define AI behavior, not workflow sequences; automations are built in Mission Control / HeadyBot.
- **Not unlimited scope.** Skills are scoped to Heady surfaces; they cannot invoke arbitrary system APIs outside of approved permission scopes.

---

## 4. User Stories

### Skill Creation (Guided)

- **As a Heady user**, I want a guided wizard that helps me define a skill by answering natural language questions ("What should this skill help with? What style should it use?"), so that I can create a useful skill without writing raw prompts.
- **As a power user**, I want to write a skill in raw SKILL.md format with a structured editor and schema validation, so that I have full control over skill behavior.
- **As a Heady user**, I want to test my skill in a sandbox session against real queries before publishing it, so that I can validate it works before deploying it.
- **As a Heady user**, I want to save a skill as a draft and iterate on it over multiple sessions, so that skill creation does not have to happen in one sitting.

### Skill Management and Distribution

- **As a Heady user**, I want to install a skill to a specific work area so that it is active when I am working in that context, so that I am not burdened with managing which skills are relevant.
- **As a skill author**, I want to publish my skill to the Liquid Module Registry with a description, category, and required permissions, so that other Heady users can find and install it.
- **As a skill author**, I want to see how many users have installed my skill and what their average rating is, so that I can understand adoption and iterate.
- **As a Heady user**, I want to fork another user's skill, modify it, and save it as my own version, so that I can build on community work without starting from scratch.

### Skill Runtime

- **As a Heady surface (Buddy / IDE / Web)**, I want to load active skills at session start and apply their instructions and tool bindings to the inference context, so that skill behavior is automatically in effect without user commands.
- **As a Heady user**, I want to invoke a skill explicitly within a session ("Use my Legal Research skill for this question"), so that I can switch skill context mid-session.

---

## 5. Requirements

### P0 — Must Have

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| SF-001 | Skill schema: YAML frontmatter (name, version, description, surfaces, permissions) + Markdown body (instructions, tool bindings, prompting strategies) | Given a SKILL.md file is uploaded, Then the Foundry validates schema and reports specific errors |
| SF-002 | Guided skill creation wizard: 5-step flow producing a valid SKILL.md from user's natural language description | Given a user completes the wizard, Then a valid SKILL.md is generated and previewed for confirmation |
| SF-003 | Skill editor: structured Markdown editor with schema validation and YAML frontmatter linting | Given a user edits a skill, Then save is blocked if frontmatter is invalid, with specific field errors shown |
| SF-004 | Skill sandbox: test a skill in a live session against sample queries without it being deployed | Given user activates sandbox mode, Then queries are processed with the skill active but no side effects persist |
| SF-005 | Skill install: bind a skill to the current user and optionally a work area | Given skill S is installed into area A, Then sessions in area A load skill S automatically |
| SF-006 | Skill library: browsable list of user's own skills and installed third-party skills | Given user opens Skill Library, Then all owned and installed skills are listed with status, surfaces, and install date |
| SF-007 | Skill uninstall / deactivate: remove skill from active context | Given user deactivates skill S, Then subsequent sessions do not load S |

### P1 — Should Have

| ID | Requirement |
|---|---|
| SF-008 | Skill publish to Liquid Module Registry with metadata (description, category, required permissions, surfaces) |
| SF-009 | Skill versioning: update a skill and track version history; users can roll back to previous version |
| SF-010 | Skill fork: copy a shared skill to user's own library for modification |
| SF-011 | Skill compose: combine multiple skills into a composite skill pack |
| SF-012 | Skill ratings and reviews: users who install a skill can leave a 1–5 star rating and optional comment |
| SF-013 | Skill telemetry for authors: install count, session count, rating average |
| SF-014 | AI-assisted skill refinement: Buddy can suggest improvements to a skill based on observed session performance |

### P2 — Future Consideration

| ID | Requirement |
|---|---|
| SF-015 | Enterprise skill governance: org admins can approve/block skills for their workspace |
| SF-016 | Skill A/B testing: run two skill variants in parallel and compare outcomes |
| SF-017 | Skill marketplace with featured, curated, and trending collections |

---

## 6. User Experience

### Skill Creation Wizard

```
Step 1: "What should this skill help with?"
        [Legal research and case analysis       ]

Step 2: "What style or approach should it use?"
        [ ✓ Precise citations  ✓ Structured output
          ✓ Flag ambiguity    ○ Conversational ]

Step 3: "Which surfaces should it work on?"
        [ ✓ HeadyBuddy  ✓ HeadyWeb  ○ HeadyAI-IDE ]

Step 4: "Does it need any connector access?"
        [ ○ None  ✓ Web search  ○ Drive  ○ Custom ]

Step 5: Preview generated SKILL.md
        [Edit] [Test in Sandbox] [Save as Draft] [Install Now]
```

### SKILL.md Format

```yaml
---
name: Legal Research Assistant
version: 1.2.0
description: Specialized skill for legal research, case analysis, and citation formatting.
surfaces:
  - buddy
  - web
permissions:
  - resource: web
    actions: [search]
tags: [legal, research, citations]
author: eric@headyconnection.org
---

## Purpose

You are a legal research assistant specialized in US federal and state case law.

## Instructions

- Always cite sources in Bluebook format.
- Flag any ambiguity in legal interpretation with [AMBIGUOUS] marker.
- Structure responses with: Summary | Relevant Cases | Analysis | Caveats.
- Do not provide specific legal advice; frame all outputs as research findings.

## Tool Bindings

- web_search: Use for finding recent case law and regulatory updates.
- When citing, prefer primary sources (court opinions, statutes) over secondary sources.

## Prompting Strategy

Before answering any legal question:
1. Identify the jurisdiction
2. Identify the legal area (contract, tort, regulatory, etc.)
3. Note the relevant standard of review if applicable
```

### Skill Library UI

```
┌─────────────────────────────────────────────────────────┐
│  SKILL LIBRARY                              [+ Create]  │
│─────────────────────────────────────────────────────────│
│  MY SKILLS (4)                                          │
│  • Legal Research Assistant  v1.2  [Active: Work area]  │
│    Surfaces: Buddy, Web   ⭐ (personal)        [Edit][▶] │
│  • Python Code Reviewer    v2.0  [Active: Dev area]     │
│    Surfaces: IDE           ⭐ (personal)        [Edit][▶] │
│                                                          │
│  INSTALLED (3)                                          │
│  • Deep Research Pack      v1.4  [Active: All areas]    │
│    Surfaces: Buddy, Web   ⭐4.7  2.3k installs  [▶][✗] │
│                                                          │
│  [Browse Registry]  [Import SKILL.md]                   │
└─────────────────────────────────────────────────────────┘
```

---

## 7. Architecture

### Skill Runtime Loading

```
Session start → Module Registry resolves installed skills for area
→ For each skill: fetch SKILL.md from storage
→ Parse instructions, tool bindings, prompting strategies
→ Inject as structured system prompt block (priority-ordered if multiple skills)
→ Agent/LLM call proceeds with enriched context
```

### Skill Storage

| Entity | Store |
|---|---|
| Skill SKILL.md content | Cloudflare R2 (versioned objects) |
| Skill metadata and manifest | Cloudflare D1 |
| Install records | Liquid Module Registry D1 (HEADY-FEAT-004) |
| Skill version history | Cloudflare R2 (versioned objects with history prefix) |

### Skill Compose Model

Composite skills reference multiple base skills:
```yaml
---
name: Client Research Bundle
version: 1.0.0
module_type: bundle
components:
  - slug: heady-deep-research
    version: "^1.4"
  - slug: heady-legal-research
    version: "^1.2"
surfaces: [buddy, web]
---
```
At runtime, all component skills are loaded and their instructions are concatenated (in defined order) into the system context.

### Guided Wizard Backend

The wizard calls a specialized Skill Generation Worker:
```
Wizard inputs (purpose, style, surfaces, permissions)
→ POST /api/skills/generate
→ Skill Generation Worker: LLM call with SKILL.md generation prompt
→ Validated SKILL.md returned
→ User previews, edits, saves
```

---

## 8. Security and Privacy

| Concern | Mitigation |
|---|---|
| Malicious skill injecting harmful instructions | Skills undergo content review before public listing; sandbox testing is sandboxed from production data |
| Skill requesting unauthorized permissions | Permission scope is declared in manifest; install-time grant required as with modules (HEADY-FEAT-004) |
| Skill exfiltrating user data via tool bindings | Tool bindings are validated against approved action list; arbitrary URLs/commands are not permitted |
| Fork abuse (stealing skills without attribution) | Fork preserves original author attribution in metadata; authors can set fork-allow flag |

---

## 9. Dependencies

| Dependency | Owner | Risk |
|---|---|---|
| Liquid Module Registry (HEADY-FEAT-004) for install/distribute | Module Registry team | High — skills are a module type |
| Memory Ledger skill performance feedback (HEADY-FEAT-002) | Memory team | Low — P2 AI refinement feature |
| MCP layer skill context injection | HeadySystems | High — skills must load into inference context |
| headyme.com Skill Library and editor UI | HeadyMe | Medium |
| HeadyIO developer portal (skill publish) | HeadyIO | Medium |

---

## 10. Phased Rollout

### Phase 1 — Core Skill Runtime (Weeks 1–4)
- SKILL.md schema and validation
- Skill storage (R2) and metadata (D1)
- Skill loading at session start via Module Registry
- Skill install / uninstall (via Module Registry flow)
- Basic Skill Library UI

### Phase 2 — Creation Tools (Weeks 5–9)
- Guided skill creation wizard
- Skill editor with schema validation
- Sandbox testing mode
- Skill versioning and rollback

### Phase 3 — Distribution (Weeks 10–14)
- Publish to Liquid Module Registry
- Skill fork
- Ratings and reviews
- Author telemetry dashboard

### Phase 4 — Composability and Intelligence (Weeks 15+)
- Skill compose (bundle type)
- AI-assisted skill refinement
- Skill marketplace collections
- Enterprise skill governance

---

## 11. Success Metrics

| Metric | Target (60 days post-launch) |
|---|---|
| % of active users with ≥ 1 active skill | ≥ 40% |
| Median time to first skill creation | ≤ 15 minutes |
| Third-party skills published to registry | ≥ 20 within 30 days of developer availability |
| User-reported AI quality improvement with domain skill | ≥ 30% vs. no-skill baseline |
| Skill fork rate (% of published skills forked) | ≥ 20% within 30 days |

---

## 12. Open Questions

| Question | Owner | Blocking? |
|---|---|---|
| What is the maximum SKILL.md size (instructions + prompt)? | Engineering | Yes — affects token budget at injection |
| When multiple skills are active, how are conflicts resolved (contradictory instructions)? | AI / Product | Yes — must define precedence rules before runtime integration |
| Should sandbox mode use a separate model to reduce costs? | Engineering / Product | No — can use the same model in v1 |
| Can users mark skills as private (not available for fork/share)? | Product | No — private by default; publish is explicit |
