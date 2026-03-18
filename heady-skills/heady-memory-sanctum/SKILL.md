---
name: heady-memory-sanctum
description: Design and operate the Heady Memory Sanctum — a protected, user-sovereign vault for sacred memories, immutable knowledge anchors, and high-trust recall. Use when architecting memory tiers with elevated protection, building vaulted recall that resists decay or redaction, or designing ceremonial memory capture for milestone moments.
metadata:
  author: eric-haywood
  version: '1.0'
---

# Heady Memory Sanctum

Use this skill when you need to **design, extend, or operate the Memory Sanctum** — a protected tier above the standard Memory Ledger where users store their most important, immutable, and high-trust memories.

## When to Use This Skill

- Designing the Sanctum architecture — vaulted storage with elevated integrity guarantees
- Creating memory promotion workflows — moving important memories from the Ledger into the Sanctum
- Building ceremonial capture flows for milestone moments (project launches, breakthroughs, key decisions)
- Defining immutability rules — what can never be altered or decayed
- Implementing Sanctum access controls stricter than standard memory privacy
- Planning disaster recovery and export for Sanctum contents

## Instructions

### 1. Define the Sanctum Tier Model

The Sanctum sits above the standard Memory Ledger as a protected tier:

```
Standard Memory Ledger (ephemeral, private, public)
        ↑ promote
Memory Sanctum (vaulted, immutable, sovereign)
```

| Property | Ledger | Sanctum |
|----------|--------|---------|
| Mutability | Soft-delete, redact | Append-only, immutable once sealed |
| Decay | Subject to retention policies | Never decays unless user explicitly purges |
| Access | Buddy + agents (per privacy level) | User-only by default; explicit grant required |
| Integrity | Hash-chained | Hash-chained + user-signed |
| Export | Standard export | Encrypted portable vault |

### 2. Design the Sanctum Entry Schema

```yaml
sanctum_entry:
  id: uuid
  created_at: ISO-8601
  sealed_at: ISO-8601          # timestamp when entry became immutable
  source:
    type: promotion | ceremony | manual
    origin_id: ledger-entry-uuid (if promoted)
  category: milestone | decision | insight | artifact | relationship
  title: short human-readable title
  content: the memory content (text, structured data, or reference)
  attachments:
    - type: file | image | code-snapshot | conversation-excerpt
      ref: storage-reference
  integrity:
    content_hash: SHA-256
    user_signature: optional user-signed hash
    chain_prev: hash of previous sanctum entry
  access:
    owner_only: true | false
    explicit_grants: [agent-id, ...]
    access_log: [timestamped access records]
  tags: [user-defined tags]
  ceremony:                     # present if captured via ceremony flow
    trigger: what prompted this capture
    context: surrounding context at capture time
    mood: optional user-annotated sentiment
```

### 3. Build Memory Promotion Workflows

Moving a memory from the Ledger to the Sanctum:

**Automatic promotion candidates:**
- Memories accessed more than N times in M days (frequently recalled = important)
- Memories tagged as "important" or "milestone" by user or agent
- Memories linked to completed high-value tasks

**Promotion flow:**
```
1. Identify candidate memory in Ledger
2. Present to user: "This memory seems important. Promote to Sanctum?"
3. User confirms and optionally adds title, tags, ceremony context
4. Memory is copied to Sanctum with full provenance chain
5. Original Ledger entry is annotated with Sanctum reference
6. Sanctum entry is sealed (immutable from this point)
```

### 4. Design Ceremonial Capture

For milestone moments, provide a structured capture experience:

```
Ceremony Trigger: User says "mark this moment" or completes a significant task

Capture Flow:
  1. Pause current workflow
  2. Gather context: what was accomplished, who was involved, what tools were used
  3. Generate a summary of the moment
  4. Ask user to annotate: title, significance, mood
  5. Seal the entry in the Sanctum with full context
  6. Provide a "receipt" — a shareable summary of the captured moment
```

**Ceremony types:**
- **Launch** — a project, feature, or product ships
- **Breakthrough** — a hard problem is solved
- **Decision** — a critical choice is made with reasoning
- **Collaboration** — a meaningful interaction with another person or agent
- **Learning** — a significant insight or skill is acquired

### 5. Implement Immutability and Integrity

Once sealed, Sanctum entries cannot be modified:

- **Append-only annotations** — users can add notes to a sealed entry but cannot change the original content
- **Hash chain** — each entry includes the hash of the previous entry, forming a tamper-evident chain
- **User signatures** — optional cryptographic signature from the user to prove authorship
- **Verification API** — any entry can be verified against its hash and chain position
- **Break-glass purge** — user can permanently delete entries, but this is logged as a break-glass event with confirmation

### 6. Plan Sanctum Access Controls

Stricter than standard memory:

| Action | Default | Override |
|--------|---------|----------|
| Read entry | Owner only | Explicit grant to specific agent |
| Search Sanctum | Owner only | Buddy with elevated permission |
| Export entry | Owner only | Never delegatable |
| Annotate entry | Owner only | Never delegatable |
| Purge entry | Owner only (break-glass) | Never delegatable |

### 7. Design Export and Portability

Users own their Sanctum and can take it anywhere:

- **Encrypted export** — full Sanctum exported as an encrypted archive
- **Selective export** — export by category, date range, or tag
- **Portable format** — JSON with embedded integrity proofs
- **Import** — restore a Sanctum archive into a new Heady instance with chain verification

## Output Format

When designing Sanctum features, produce:

1. **Tier model** showing Sanctum's relationship to the Ledger
2. **Entry schema** with all fields and constraints
3. **Promotion workflow** with triggers and user interactions
4. **Ceremony capture flow** with templates
5. **Integrity mechanism** specification
6. **Access control matrix**

## Tips

- **Sanctum is sacred** — treat it with the gravity users expect; this is where their most valued memories live
- **Immutability is the core promise** — once sealed, nothing changes; this is what builds trust
- **Ceremonies create emotional anchors** — the capture experience matters as much as the storage
- **Keep the chain honest** — a broken hash chain is a critical integrity failure; monitor and alert
- **Export is a right** — users must always be able to take their Sanctum data with them
