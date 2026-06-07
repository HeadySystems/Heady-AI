<!-- HEADY_BRAND:BEGIN
<!-- ╔══════════════════════════════════════════════════════════════════╗
<!-- ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
<!-- ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
<!-- ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
<!-- ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
<!-- ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
<!-- ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
<!-- ║                                                                  ║
<!-- ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
<!-- ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
<!-- ║  FILE: enterprise/analytics/events/event-tracking-spec.md                                                    ║
<!-- ║  LAYER: root                                                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
# Heady™Systems — Product Analytics Event Specification

**Version:** 1.0.0  
**φ-revision:** 1.618  
**Last Updated:** 2026-03-07  
**Owner:** Platform Engineering

---

## Overview

This specification defines all product analytics events tracked by the Heady™Systems platform. Events are emitted by frontend, backend, and agent subsystems, ingested via `POST /analytics/events`, batched (fib(12)=144), and forwarded to BigQuery/DuckDB.

All events follow a common envelope schema with event-specific property payloads.

---

## Common Envelope Schema

Every event MUST include these top-level fields:

```typescript
{
  event:      string;          // snake_case event name
  eventId:    string;          // UUID — used for deduplication
  timestamp:  string;          // ISO 8601 UTC
  userId:     string | null;   // authenticated user ID or null
  sessionId:  string;          // browser/API session ID
  orgId:      string | null;   // organization/tenant ID
  version:    string;          // schema version, e.g. "1.0"
  source:     "web" | "api" | "sdk" | "agent" | "system";
  properties: Record<string, unknown>;  // event-specific fields
  context: {
    ip:         string;        // anonymized (last octet zeroed)
    userAgent:  string;
    locale:     string;
    timezone:   string;
    platform:   string;        // "web" | "mobile" | "cli"
    appVersion: string;
  };
}
```

---

## CSL Engagement Scoring

Event importance is scored using Continuous Semantic Logic (CSL) levels:

| CSL Level | Range    | Examples |
|-----------|----------|---------|
| DORMANT   | 0.0–0.236 | page_view, hover |
| LOW       | 0.236–0.382 | search, browse |
| MODERATE  | 0.382–0.618 | signup, login, settings |
| HIGH      | 0.618–0.854 | agent creation, billing |
| CRITICAL  | 0.854–1.0  | billing, data export |

---

## Events

---

### 1. `user.signup`

**Trigger:** User completes registration (email verification or OAuth)  
**CSL Level:** HIGH (0.854)

#### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `method` | `"email" \| "google" \| "github" \| "sso"` | ✓ | Registration method |
| `plan` | `"free" \| "pro" \| "enterprise"` | ✓ | Selected plan at signup |
| `referrer` | string | — | UTM referrer or direct |
| `inviteCode` | string | — | Referral/invite code used |
| `orgName` | string | — | Org name entered at signup |
| `isTrial` | boolean | ✓ | Whether starting a trial |
| `trialDays` | number | — | Trial length (fib-scaled: 5, 8, 13, 21 days) |

#### Example Payload

```json
{
  "event": "user.signup",
  "eventId": "evt_01J8ZQK3M4NRXP7VBWF2H6A9C",
  "timestamp": "2026-03-07T14:30:00.000Z",
  "userId": "usr_01J8ZQK3M4NR",
  "sessionId": "sess_abc123",
  "orgId": null,
  "version": "1.0",
  "source": "web",
  "properties": {
    "method": "google",
    "plan": "pro",
    "referrer": "utm_source=producthunt",
    "isTrial": true,
    "trialDays": 13
  },
  "context": {
    "ip": "192.168.1.0",
    "userAgent": "Mozilla/5.0...",
    "locale": "en-US",
    "timezone": "America/Denver",
    "platform": "web",
    "appVersion": "3.2.2"
  }
}
```

---

### 2. `user.login`

**Trigger:** Successful authentication  
**CSL Level:** MODERATE (0.618)

#### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `method` | `"email" \| "google" \| "github" \| "sso" \| "api_key"` | ✓ | Auth method |
| `mfaUsed` | boolean | ✓ | Whether MFA was used |
| `mfaMethod` | `"totp" \| "sms" \| "webauthn"` | — | MFA type if used |
| `consecutiveFailures` | number | ✓ | Prior failed attempts (0 = clean login) |
| `newDevice` | boolean | ✓ | First login from this device |
| `ipChanged` | boolean | ✓ | Login from a new IP |

#### Example Payload

```json
{
  "event": "user.login",
  "eventId": "evt_02K9AR4N5OSSY",
  "timestamp": "2026-03-07T14:35:00.000Z",
  "userId": "usr_01J8ZQK3M4NR",
  "sessionId": "sess_def456",
  "orgId": "org_acmecorp",
  "version": "1.0",
  "source": "web",
  "properties": {
    "method": "sso",
    "mfaUsed": true,
    "mfaMethod": "webauthn",
    "consecutiveFailures": 0,
    "newDevice": false,
    "ipChanged": false
  }
}
```

---

### 3. `agent.created`

**Trigger:** User creates a new agent definition  
**CSL Level:** HIGH (0.854)

#### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `agentId` | string | ✓ | New agent's ID |
| `agentType` | `"assistant" \| "orchestrator" \| "specialist" \| "tool"` | ✓ | Agent archetype |
| `mcpTools` | string[] | ✓ | MCP tools enabled at creation |
| `memoryEnabled` | boolean | ✓ | Vector memory enabled |
| `templateUsed` | string | — | Template/preset name if from template |
| `cslThreshold` | number | ✓ | Agent's CSL activation threshold |
| `totalAgents` | number | ✓ | User's total agent count after this creation |

#### Example Payload

```json
{
  "event": "agent.created",
  "eventId": "evt_03L0BS5O6PTTZ",
  "timestamp": "2026-03-07T15:00:00.000Z",
  "userId": "usr_01J8ZQK3M4NR",
  "sessionId": "sess_ghi789",
  "orgId": "org_acmecorp",
  "version": "1.0",
  "source": "web",
  "properties": {
    "agentId": "agt_heady_analyst",
    "agentType": "specialist",
    "mcpTools": ["web_search", "code_execution", "file_read"],
    "memoryEnabled": true,
    "templateUsed": "data-analyst",
    "cslThreshold": 0.618,
    "totalAgents": 3
  }
}
```

---

### 4. `agent.invoked`

**Trigger:** Agent receives a task invocation  
**CSL Level:** HIGH (0.764)

#### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `agentId` | string | ✓ | Agent being invoked |
| `taskId` | string | ✓ | Associated task ID |
| `invocationMethod` | `"api" \| "sdk" \| "ui" \| "scheduled" \| "webhook"` | ✓ | How the agent was triggered |
| `inputTokens` | number | ✓ | Estimated input tokens |
| `cslScore` | number | ✓ | Activation CSL score (0.0–1.0) |
| `toolsAvailable` | number | ✓ | Count of available MCP tools |

#### Example Payload

```json
{
  "event": "agent.invoked",
  "eventId": "evt_04M1CT6P7QUUA",
  "timestamp": "2026-03-07T15:02:00.000Z",
  "userId": "usr_01J8ZQK3M4NR",
  "sessionId": "sess_jkl012",
  "orgId": "org_acmecorp",
  "version": "1.0",
  "source": "api",
  "properties": {
    "agentId": "agt_heady_analyst",
    "taskId": "tsk_20260307001",
    "invocationMethod": "api",
    "inputTokens": 1618,
    "cslScore": 0.764,
    "toolsAvailable": 8
  }
}
```

---

### 5. `task.submitted`

**Trigger:** User or agent submits a task for execution  
**CSL Level:** HIGH (0.764)

#### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `taskId` | string | ✓ | Unique task ID |
| `taskType` | `"analysis" \| "generation" \| "search" \| "code" \| "orchestration"` | ✓ | Task category |
| `priority` | number | ✓ | Fibonacci priority (1,1,2,3,5,8,13,21) |
| `estimatedComplexity` | number | ✓ | CSL score 0.0–1.0 |
| `agentId` | string | ✓ | Target agent ID |
| `parentTaskId` | string | — | Parent task if subtask |
| `queueDepth` | number | ✓ | Queue depth at submission |

#### Example Payload

```json
{
  "event": "task.submitted",
  "eventId": "evt_05N2DU7Q8RVVB",
  "timestamp": "2026-03-07T15:02:01.000Z",
  "userId": "usr_01J8ZQK3M4NR",
  "sessionId": "sess_jkl012",
  "orgId": "org_acmecorp",
  "version": "1.0",
  "source": "api",
  "properties": {
    "taskId": "tsk_20260307001",
    "taskType": "analysis",
    "priority": 8,
    "estimatedComplexity": 0.618,
    "agentId": "agt_heady_analyst",
    "parentTaskId": null,
    "queueDepth": 3
  }
}
```

---

### 6. `task.completed`

**Trigger:** Task execution finishes (success or failure)  
**CSL Level:** HIGH (0.764)

#### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `taskId` | string | ✓ | Task ID |
| `agentId` | string | ✓ | Executing agent ID |
| `status` | `"success" \| "partial" \| "failed" \| "timeout"` | ✓ | Outcome |
| `durationMs` | number | ✓ | Wall clock time |
| `outputTokens` | number | ✓ | Generated output tokens |
| `toolCallCount` | number | ✓ | Number of MCP tool calls made |
| `memoryReads` | number | ✓ | Vector memory lookups |
| `memoryWrites` | number | ✓ | Vector memory stores |
| `cslScore` | number | ✓ | Final task confidence score |
| `cost` | number | — | Estimated compute cost (USD) |

#### Example Payload

```json
{
  "event": "task.completed",
  "eventId": "evt_06O3EV8R9SWWC",
  "timestamp": "2026-03-07T15:02:34.000Z",
  "userId": "usr_01J8ZQK3M4NR",
  "sessionId": "sess_jkl012",
  "orgId": "org_acmecorp",
  "version": "1.0",
  "source": "api",
  "properties": {
    "taskId": "tsk_20260307001",
    "agentId": "agt_heady_analyst",
    "status": "success",
    "durationMs": 34000,
    "outputTokens": 987,
    "toolCallCount": 5,
    "memoryReads": 13,
    "memoryWrites": 3,
    "cslScore": 0.854,
    "cost": 0.0162
  }
}
```

---

### 7. `mcp.tool.called`

**Trigger:** Agent invokes an MCP tool  
**CSL Level:** MODERATE (0.618)

#### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `toolName` | string | ✓ | MCP tool name |
| `serverId` | string | ✓ | MCP server ID |
| `agentId` | string | ✓ | Calling agent |
| `taskId` | string | ✓ | Associated task |
| `durationMs` | number | ✓ | Tool execution time |
| `success` | boolean | ✓ | Whether tool call succeeded |
| `cacheHit` | boolean | ✓ | Whether result was cached |
| `errorCode` | string | — | Error code if failed |

#### Example Payload

```json
{
  "event": "mcp.tool.called",
  "eventId": "evt_07P4FW9S0TXXD",
  "timestamp": "2026-03-07T15:02:10.000Z",
  "userId": "usr_01J8ZQK3M4NR",
  "sessionId": "sess_jkl012",
  "orgId": "org_acmecorp",
  "version": "1.0",
  "source": "agent",
  "properties": {
    "toolName": "web_search",
    "serverId": "mcp-heady-web",
    "agentId": "agt_heady_analyst",
    "taskId": "tsk_20260307001",
    "durationMs": 1618,
    "success": true,
    "cacheHit": false
  }
}
```

---

### 8. `memory.stored`

**Trigger:** Vector memory record is written  
**CSL Level:** MODERATE (0.618)

#### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `memoryId` | string | ✓ | Memory record ID |
| `agentId` | string | ✓ | Agent writing memory |
| `contentType` | `"fact" \| "experience" \| "skill" \| "context"` | ✓ | Memory category |
| `vectorDimensions` | number | ✓ | Embedding dimension count |
| `cslImportance` | number | ✓ | CSL score for this memory |
| `namespace` | string | ✓ | Memory namespace |

#### Example Payload

```json
{
  "event": "memory.stored",
  "eventId": "evt_08Q5GX0T1UYYF",
  "timestamp": "2026-03-07T15:02:30.000Z",
  "userId": "usr_01J8ZQK3M4NR",
  "sessionId": "sess_jkl012",
  "orgId": "org_acmecorp",
  "version": "1.0",
  "source": "agent",
  "properties": {
    "memoryId": "mem_20260307abc",
    "agentId": "agt_heady_analyst",
    "contentType": "experience",
    "vectorDimensions": 1536,
    "cslImportance": 0.764,
    "namespace": "org_acmecorp:analyst"
  }
}
```

---

### 9. `memory.searched`

**Trigger:** Agent performs a vector similarity search  
**CSL Level:** LOW (0.382)

#### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `agentId` | string | ✓ | Searching agent |
| `taskId` | string | ✓ | Associated task |
| `queryType` | `"semantic" \| "keyword" \| "hybrid"` | ✓ | Search method |
| `resultsReturned` | number | ✓ | Result count |
| `topScore` | number | ✓ | Best similarity score |
| `durationMs` | number | ✓ | Search latency |
| `namespace` | string | ✓ | Memory namespace searched |

#### Example Payload

```json
{
  "event": "memory.searched",
  "eventId": "evt_09R6HY1U2VZZG",
  "timestamp": "2026-03-07T15:02:08.000Z",
  "userId": "usr_01J8ZQK3M4NR",
  "sessionId": "sess_jkl012",
  "orgId": "org_acmecorp",
  "version": "1.0",
  "source": "agent",
  "properties": {
    "agentId": "agt_heady_analyst",
    "taskId": "tsk_20260307001",
    "queryType": "semantic",
    "resultsReturned": 5,
    "topScore": 0.934,
    "durationMs": 8,
    "namespace": "org_acmecorp:analyst"
  }
}
```

---

### 10. `billing.upgraded`

**Trigger:** User upgrades to a higher plan tier  
**CSL Level:** CRITICAL (0.910)

#### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `fromPlan` | `"free" \| "pro" \| "enterprise"` | ✓ | Previous plan |
| `toPlan` | `"pro" \| "enterprise"` | ✓ | New plan |
| `mrr` | number | ✓ | New MRR contribution (USD) |
| `billingCycle` | `"monthly" \| "annual"` | ✓ | Billing frequency |
| `promoCode` | string | — | Promo code applied |
| `upgradeSource` | `"in-app" \| "email" \| "sales" \| "trial-expiry"` | ✓ | What triggered upgrade |
| `trialDaysUsed` | number | — | Trial days consumed before upgrade |

#### Example Payload

```json
{
  "event": "billing.upgraded",
  "eventId": "evt_10S7IZ2V3W00H",
  "timestamp": "2026-03-07T16:00:00.000Z",
  "userId": "usr_01J8ZQK3M4NR",
  "sessionId": "sess_mno345",
  "orgId": "org_acmecorp",
  "version": "1.0",
  "source": "web",
  "properties": {
    "fromPlan": "free",
    "toPlan": "pro",
    "mrr": 89.00,
    "billingCycle": "monthly",
    "promoCode": null,
    "upgradeSource": "in-app",
    "trialDaysUsed": 8
  }
}
```

---

### 11. `feedback.submitted`

**Trigger:** User submits feedback (thumbs up/down, NPS, written)  
**CSL Level:** MODERATE (0.618)

#### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `feedbackType` | `"thumbs" \| "nps" \| "csat" \| "written" \| "bug_report"` | ✓ | Feedback category |
| `score` | number | — | Numeric rating (NPS: 0–10, CSAT: 1–5, thumbs: -1/+1) |
| `positive` | boolean | — | For thumbs up/down |
| `context` | string | — | Where feedback was triggered |
| `agentId` | string | — | Agent being rated (if applicable) |
| `taskId` | string | — | Task being rated (if applicable) |
| `comment` | string | — | Qualitative comment |
| `tags` | string[] | — | User-selected feedback tags |

#### Example Payload

```json
{
  "event": "feedback.submitted",
  "eventId": "evt_11T8JA3W4X11I",
  "timestamp": "2026-03-07T15:03:00.000Z",
  "userId": "usr_01J8ZQK3M4NR",
  "sessionId": "sess_jkl012",
  "orgId": "org_acmecorp",
  "version": "1.0",
  "source": "web",
  "properties": {
    "feedbackType": "thumbs",
    "positive": true,
    "context": "task_result",
    "agentId": "agt_heady_analyst",
    "taskId": "tsk_20260307001",
    "comment": "Great result, very accurate",
    "tags": ["accurate", "fast"]
  }
}
```

---

## Event Index

| # | Event Name | CSL Level | Source | Funnels |
|---|-----------|-----------|--------|---------|
| 1 | `user.signup` | HIGH | web | acquisition → activation |
| 2 | `user.login` | MODERATE | web/api | engagement |
| 3 | `agent.created` | HIGH | web | activation |
| 4 | `agent.invoked` | HIGH | api/sdk | retention |
| 5 | `task.submitted` | HIGH | api/sdk | retention |
| 6 | `task.completed` | HIGH | system | retention |
| 7 | `mcp.tool.called` | MODERATE | agent | feature adoption |
| 8 | `memory.stored` | MODERATE | agent | feature adoption |
| 9 | `memory.searched` | LOW | agent | feature adoption |
| 10 | `billing.upgraded` | CRITICAL | web | revenue |
| 11 | `feedback.submitted` | MODERATE | web | NPS/CSAT |

---

## Validation Rules

1. `eventId` MUST be unique per event (UUID v4 or ULID)
2. `timestamp` MUST be UTC ISO 8601 with milliseconds
3. `userId` MAY be null for pre-auth events only (signup step 1)
4. `properties` MUST include all Required fields (✓ above)
5. CSL scores MUST be in range `[0.0, 1.0]`
6. Fibonacci priority values MUST be from: `[1,1,2,3,5,8,13,21]`
7. All token counts MUST be non-negative integers
