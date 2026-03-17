# Feature Spec: Trust Receipts and Action Playback

**Feature ID:** HEADY-FEAT-007  
**Domain:** headysystems.com / headyme.com  
**Status:** Draft  
**Author:** Eric Haywood  
**Date:** 2026-03-17  
**Version:** 1.0

---

## 1. Problem Statement

As Heady agents take consequential actions on behalf of users — sending emails, writing files, submitting pull requests, posting messages, modifying calendars — there is no persistent, verifiable record that a given action was performed, by what agent, under what authority, and with what exact content. Users who delegate autonomous work to agents have no way to verify what was done or reconstruct the sequence of events if something goes wrong.

This "invisible agency" problem creates several failures: users cannot audit what their AI did; disputed agent actions cannot be investigated; there is no rollback reference for unintended changes; and there is no way to replay a successful workflow to verify it can be reproduced. Without trust infrastructure, agentic AI remains a source of anxiety rather than confidence.

**Who experiences this:** All users of HeadyBuddy, HeadyBot, and HeadyAI-IDE in agentic mode; professionals with compliance obligations; any user who has experienced a surprising or unexpected agent outcome.

**Cost of not solving it:** Permanent trust deficit in agentic workflows; inability to achieve professional/enterprise use cases; no foundation for audit-required contexts (legal, financial, medical); direct liability exposure for Heady if agents take harmful actions without any record.

---

## 2. Goals

| Goal | Measurement | Target |
|---|---|---|
| Every consequential agent action produces a verifiable Trust Receipt | % of P0-classified agent actions with an associated receipt | 100% |
| Users can replay any past action sequence to verify what happened | Action Playback launch rate among agentic users | ≥ 40% within 60 days |
| Trust Receipts are tamper-evident | % of receipt integrity checks that detect tampering in QA tests | 100% |
| Users can export receipts for external audit or compliance | Receipt export completion rate | ≥ 99% |
| Users feel more confident in agentic workflows after receipts launch | Pre/post trust score for "I understand what my AI did" | +20% improvement |

---

## 3. Non-Goals

- **Not a blockchain / distributed ledger.** Tamper-evidence is achieved via cryptographic signatures in a centralized Heady system; distributed consensus is out of scope.
- **Not a general file versioning or backup system.** Receipts record agent actions, not full document state; integration with version history is a future capability.
- **Not a legal guarantee.** Receipts provide evidence of agent action; they are not a substitute for legal documentation in regulated industries.
- **Not real-time streaming of every LLM token.** Playback reconstructs action-level steps, not token-by-token generation.
- **Not undo/redo infrastructure.** Rollback of agent actions is a future capability built on top of receipts; v1 is record-and-replay only.

---

## 4. User Stories

### Trust Receipt Creation

- **As a Heady agent**, I want to create a Trust Receipt for every consequential action I take, automatically and without user intervention, so that every significant action has a record.
- **As a Heady user**, I want to see a Trust Receipt card immediately after an agent completes a significant action, so that I am informed in real time what was done.
- **As a Heady user**, I want Trust Receipts to include the exact content of what was sent/created/modified (or a hash of it), so that I can verify the action precisely.

### Action Playback

- **As a Heady user**, I want to replay any past task as a step-by-step walkthrough showing what the agent did at each stage, so that I can understand complex multi-step workflows.
- **As a Heady user**, I want to compare the planned steps of a task against what was actually executed, so that I can identify divergence from intent.
- **As a HeadyAI-IDE user**, I want to replay a code change sequence and see the diff at each step, so that I can review what the agent changed and why.

### Audit and Export

- **As a Heady user**, I want to search and filter my Trust Receipt history by action type, agent, date, and work area, so that I can find specific receipts quickly.
- **As a Heady user**, I want to export a receipt or a set of receipts as a signed PDF or JSON, so that I can share evidence of agent actions with external parties.
- **As a professional with compliance requirements**, I want Trust Receipts to include timestamp, agent identity, scope/permissions used, and content hash in a format compatible with audit requirements, so that I can satisfy my organization's audit needs.

---

## 5. Requirements

### P0 — Must Have

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| TR-001 | Trust Receipt schema: action_type, agent_id, user_id, timestamp, permission_grant_id, content_hash, content_preview, outcome, signature | Given an agent completes a P0 action, Then a receipt is created within 2 seconds |
| TR-002 | Consequential action classification: define P0 action types (email:send, file:write, calendar:create/modify, message:post, code:push, form:submit) | Given an agent performs an email:send, Then it is classified as P0 and a receipt is created; reading email is not P0 |
| TR-003 | Cryptographic signing: each receipt is signed with a Heady-held HMAC key (per user); signature is stored and verifiable | Given a receipt is fetched, When integrity check runs, Then the signature matches the receipt content |
| TR-004 | Receipt storage: receipts are written to an append-only store per user | Given a receipt is created, Then it cannot be modified; any subsequent state is a new receipt entry |
| TR-005 | Trust Receipt history UI: chronological list filterable by action type, agent, date, area | Given user opens receipt history, Then all receipts are visible with action type, agent, timestamp, and outcome |
| TR-006 | Receipt detail view: shows full receipt data including content preview/hash, permissions used, and step in the task sequence | Given user selects a receipt, Then all receipt fields are visible |
| TR-007 | Content hash display: content of agent output is SHA-256 hashed; hash is shown in receipt; full content optionally retrievable if stored | Given an email:send action, Then the receipt includes SHA-256 hash of the sent email body |

### P1 — Should Have

| ID | Requirement |
|---|---|
| TR-008 | Action Playback: animated step-by-step walkthrough of a completed task showing agent decision points and actions taken |
| TR-009 | Receipt export: export individual receipt or filtered set as signed JSON or PDF |
| TR-010 | Task-level receipt grouping: receipts in the same task are linked and can be viewed as a unified task audit trail |
| TR-011 | Content preview: for text-based actions (email, message, document write), a truncated content preview (first 200 chars) is stored in the receipt |
| TR-012 | Receipt verification tool: user can paste a receipt JSON and verify its signature is valid |

### P2 — Future Consideration

| ID | Requirement |
|---|---|
| TR-013 | Rollback suggestion: for select action types, surface a rollback option linked to the receipt (e.g., "Delete this calendar event") |
| TR-014 | Cross-organization receipt sharing (for enterprise audit scenarios) |
| TR-015 | Webhook delivery: receipts pushed to user-configured endpoint in real time |
| TR-016 | Long-term receipt archival with user-controlled retention policy |

---

## 6. User Experience

### Trust Receipt Card (Post-Action, In-Session)

```
┌─────────────────────────────────────────────────────────┐
│  ✓ TRUST RECEIPT — Email Sent                          │
│─────────────────────────────────────────────────────────│
│  Agent: HeadyBuddy (Research Mode)                      │
│  Time: 4:47 PM, March 17, 2026                         │
│  Permission: gmail:send (grant exp. 2026-03-24)        │
│                                                          │
│  Content preview: "Hi Jamie, please find the Q1..."     │
│  Content hash: SHA-256: a3f2b1c9...                    │
│                                                          │
│  [View Full Receipt]  [View in Receipt History]         │
└─────────────────────────────────────────────────────────┘
```

### Receipt History UI

```
┌─────────────────────────────────────────────────────────┐
│  TRUST RECEIPT HISTORY                                  │
│  Filter: [All Actions ▼] [All Agents ▼] [Date ▼]       │
│─────────────────────────────────────────────────────────│
│  Today, March 17                                        │
│  4:47 PM  ✉ Email Sent     Buddy  gmail:send  ✓  [▶]   │
│  4:22 PM  📄 File Written  IDE    drive:write ✓  [▶]   │
│  2:15 PM  📅 Event Created Buddy  cal:write   ✓  [▶]   │
│                                                          │
│  March 16                                               │
│  9:33 AM  🔀 PR Commented  IDE    github:pr   ✓  [▶]   │
│                                                          │
│  [Export Selected]  [Export All]                        │
└─────────────────────────────────────────────────────────┘
```

### Action Playback

```
TASK PLAYBACK: Q1 Competitive Research
─────────────────────────────────────────
[◀◀] [◀] [▶] [▶▶]  Step 3 of 7  ████░░░░ 43%

Step 3: Synthesized findings from 4 sources
─────────────────────────────────────────
Agent reasoning: "Cross-referencing SEC filings with
market reports to identify revenue trends..."

Sources referenced: [WSJ article], [10-K filing], [Gartner report]

Output produced: [View draft — 847 words]
Content hash: b2a9c3f1...

[Next Step ▶]
```

---

## 7. Architecture

### Trust Receipt Data Model

```json
{
  "receipt_id": "uuid",
  "user_id": "string",
  "task_id": "string | null",
  "step_number": "integer | null",
  "agent_id": "string",
  "agent_type": "buddy | ide | bot | web",
  "action_type": "email:send | file:write | calendar:create | message:post | code:push | form:submit | ...",
  "area_id": "string",
  "permission_grant_id": "string",
  "timestamp": "ISO8601",
  "outcome": "success | failure | partial",
  "content_preview": "string (max 200 chars) | null",
  "content_hash": "sha256:string",
  "content_stored": true,
  "content_ref": "r2://receipts/{user_id}/{receipt_id}/content",
  "metadata": { "target": "email address or resource URI", "size_bytes": 0 },
  "signature": "hmac-sha256:string"
}
```

### Signing Protocol

```
On receipt creation:
  canonical_payload = JSON.stringify(receipt, sorted keys, without signature field)
  signature = HMAC-SHA256(canonical_payload, user_receipt_signing_key)
  receipt.signature = "hmac-sha256:" + base64(signature)

On verification:
  canonical_payload = JSON.stringify(receipt, sorted keys, without signature field)
  expected = HMAC-SHA256(canonical_payload, user_receipt_signing_key)
  assert base64(expected) == receipt.signature.split(":")[1]
```

Signing keys are per-user, stored in Cloudflare Secrets; never exposed to client.

### Storage Architecture

| Entity | Store | Notes |
|---|---|---|
| Receipt records | Cloudflare D1 (append-only, no UPDATE allowed) | Indexed by user_id, task_id, action_type, timestamp |
| Receipt content (full body) | Cloudflare R2 | Stored at receipt creation if content_stored = true |
| Signing keys | Cloudflare Secrets (per user, rotated annually) | Never returned to client |
| Action Playback state | Cloudflare D1 (task step records with receipt links) | Queried to reconstruct playback |

### Data Flows

**Receipt Creation (Agent Action):**
```
Agent completes P0 action → headymcp.com MCP layer
→ Action classified (P0 or not)
→ If P0: Receipt Creation Worker invoked
→ Content hashed (SHA-256) + content stored to R2 (if text-based action)
→ Receipt record built + signed with user signing key
→ Written to D1 append-only
→ Event emitted: "receipt_created" → SSE stream (Mission Control / UI)
```

**Playback:**
```
User selects task in Receipt History → GET /api/receipts/playback?task_id=X
→ Worker queries D1: all receipts for task_id, ordered by step_number
→ For each receipt: fetch content preview / content from R2 if available
→ Return ordered array of receipt + content snapshots
→ UI renders step-by-step playback
```

---

## 8. Security and Privacy

| Concern | Mitigation |
|---|---|
| Receipt tampering (post-creation modification) | D1 enforces no UPDATE on receipt table; all entries append-only; signature validates content |
| Signing key compromise | Keys are per-user, stored in Cloudflare Secrets; compromise of one key does not affect others; annual rotation |
| Receipt content exposure to other users | All D1 and R2 queries scoped by user_id; no cross-user access |
| Sensitive content in receipt content store | Content stored encrypted at rest; access controlled by Heady auth; never returned in bulk list responses |
| Receipt export containing sensitive data | Export generates signed, time-limited presigned URL (1 hour TTL); not cacheable |
| GDPR right to erasure | Receipts can be deleted on account deletion; retention policy configurable by user (default 1 year) |

---

## 9. Dependencies

| Dependency | Owner | Risk |
|---|---|---|
| MCP layer action classification and receipt hook | HeadySystems | High — must be in MCP pipeline before any enforcement |
| Permission Graph (HEADY-FEAT-001) grant_id reference | Permission team | Medium — receipts reference active grant |
| Mission Control SSE stream (HEADY-FEAT-005) for real-time receipt notification | Mission Control team | Medium — notifications depend on SSE |
| Cloudflare R2 for content storage | Infrastructure | Low |
| headyme.com Receipt History UI | HeadyMe | Medium |

---

## 10. Phased Rollout

### Phase 1 — Receipt Infrastructure (Weeks 1–4)
- Receipt data model and D1 append-only schema
- Signing key generation and storage
- MCP layer P0 action classification
- Receipt Creation Worker
- Basic Receipt History UI (list only)

### Phase 2 — Content and Detail (Weeks 5–8)
- Content hashing and R2 content storage
- Receipt detail view (full fields)
- In-session Trust Receipt card notification
- Receipt export (JSON)

### Phase 3 — Playback (Weeks 9–12)
- Task-level receipt grouping
- Action Playback UI
- Playback content retrieval
- Receipt verification tool

### Phase 4 — Audit Grade (Weeks 13+)
- Signed PDF export
- Long-term retention policy settings
- Rollback suggestion (select action types)
- Webhook delivery endpoint

---

## 11. Success Metrics

| Metric | Target (60 days post-launch) |
|---|---|
| % of P0 actions with Trust Receipt | 100% |
| Receipt integrity check failure rate | 0% |
| Action Playback monthly active users | ≥ 40% of agentic users |
| User trust score: "I understand what my AI did" | +20% vs. pre-launch baseline |
| Receipt export usage | ≥ 15% of agentic users export at least one receipt |

---

## 12. Open Questions

| Question | Owner | Blocking? |
|---|---|---|
| What is the exhaustive P0 action type list? | Product / Security | Yes — must finalize before MCP classification |
| Should non-P0 actions (reads, searches) also produce receipts at a lower fidelity? | Product | No — can add in Phase 2 as P1-receipts |
| What is the max content size stored per receipt? | Engineering | No — recommend 10KB plaintext |
| Should receipt content storage be opt-out for privacy-first users? | Legal / Product | Yes — consent model must be defined |
| How long are signing keys valid before mandatory rotation? | Security | No — annual rotation default |
