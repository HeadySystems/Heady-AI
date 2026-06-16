---
name: heady-companion-memory
description: "Use when the user wants a persistent assistant experience with long-term memory, preference learning, anticipatory suggestions, or task continuity across sessions and devices. Helpful for companion design, memory-grounded assistants, proactive assistance, and user preference adaptation in both personal and technical workflows."
---

> **OPTIMAL BUILD NOTICE:** This file has been auto-migrated for the Heady-AI Latent OS (v2.0.0).
> - **Package Manager:** Use `pnpm` and `Turborepo`
> - **Frontend:** Vite SPAs + Vanilla Web Components (React only for complex canvas)
> - **Event Bus:** NATS (`heady-event-bus`)
> - **Sandbox:** WASM WebContainers
> - **UI Sync:** Server-Sent Events (SSE) + HTTP/2
> - **Vector Trigger:** Merkle-Tree File Hashing
> - **Rule File:** Follow `AGENTS.md`

# Heady™ Companion Memory

## When to Use This Skill

Use this skill when the user asks for:

- a persistent memory layer for an assistant
- anticipatory or proactive assistance
- preference learning over time
- cross-session continuity
- companion-style task support

## Instructions

1. Separate memory into durable categories:
   - identity and profile
   - preferences
   - recurring projects
   - active commitments
   - sensitive exclusions
2. Define what the system should remember automatically versus only with explicit approval.
3. Keep retrieval purposeful:
   - only recall what improves the current task
   - do not flood the response with memory
4. Design proactive suggestions carefully:
   - based on prior goals
   - bounded by relevance
   - easy to dismiss
5. Add user controls for:
   - memory on or off
   - review or correction
   - lightweight versus deep personalization
6. If tasks span devices or sessions, define a continuity summary format.
7. Add safeguards for stale or uncertain memory.
8. End with:
   - Memory Model
   - Retrieval Rules
   - Suggestion Policy

## Output Pattern

- User Context Model
- Memory Categories
- Retrieval Policy
- Suggestion Triggers
- Safety Controls

## Example Prompts

- Design a memory layer for my always-on AI companion
- Help my assistant learn preferences without becoming intrusive
- Create a continuity model for cross-session task support

## Provenance

This skill is grounded in the public HeadyBuddy positioning around persistent learning and "anticipatory suggestions" on [headybuddy.org](https://headybuddy.org/) and the memory-oriented dashboard signals visible on [headyme.com](https://headyme.com/).
