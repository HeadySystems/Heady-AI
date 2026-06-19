---
name: heady-seed
description: "Ingests raw, sparse ideas and unstructured thoughts from the user. Uses AutoContext to intelligently expand the seed, tag it by domain, and store it in the IDEA_VAULT for passive incubation."
---

# Heady Idea Seed Protocol (`/heady-seed`)

The **Idea Seed** workflow is the Latent OS's "Cognitive Drop-Box." It allows the user to dump half-formed thoughts, ideas, or architectural suggestions from any device (Desktop IDE, HeadyBuddy Mobile, or Web) without requiring a formal specification.

## Trigger Mechanics
```
/heady-seed "Your raw idea goes here"
```

## The 3-Stage Ingestion Pipeline

### Stage 1: Concept Extraction
- The agent intercepts the raw input string.
- It queries the Heady AutoContext engine: *"Which existing components, repositories, or domains does this raw idea touch?"*
- It generates a 1-2 sentence expansion mapping the idea to specific Latent OS mechanisms.

### Stage 2: Ledger Appending (Idea Vault)
- The agent opens `/docs/research/IDEA_VAULT.md`.
- It formats the idea into a structured `[SEED-XXX]` entry.
- It tags the entry with the relevant domains discovered in Stage 1 (e.g., `[Auth]`, `[Omni-Sync]`).
- It appends the entry to the top of the vault.

### Stage 3: Passive Incubation
- The workflow terminates without executing the idea.
- The seed is now permanently embedded in the Latent OS vector space.
- **AutoContext Retrieval:** In future sessions, when an agent begins work on a component matching the seed's tags, the vector retrieval engine will naturally pull the seed into the agent's context window, effectively saying: *"The user previously had this idea regarding this component."*

## Usage Note
Do **not** use `/heady-seed` for immediate bug fixes or tasks that require immediate execution. This workflow is strictly for passive incubation and architectural roadmap shaping.
