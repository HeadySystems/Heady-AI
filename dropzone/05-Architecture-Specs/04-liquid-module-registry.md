# Feature Spec: Liquid Module Registry for Dynamic App and Connector Delivery

**Feature ID:** HEADY-FEAT-004  
**Domain:** headyio.com / headysystems.com / headyme.com  
**Status:** Draft  
**Author:** Eric Haywood  
**Date:** 2026-03-17  
**Version:** 1.0

---

## 1. Problem Statement

The Heady ecosystem is expanding rapidly across surfaces (Buddy, IDE, Web, Bot) and capabilities (skills, connectors, automations, UI modules). Today there is no unified registry for discovering, installing, versioning, and dynamically delivering these modules to the right surface and user context. Modules are deployed statically, without runtime configuration, and without any delivery intelligence.

As a result: new capabilities require full deployments; users cannot discover or try capabilities ad hoc; developers have no marketplace to publish and distribute; and the system cannot compose capabilities dynamically based on context or user needs. This fundamentally limits Heady's scalability as a platform.

**Who experiences this:** All Heady users who want to extend or customize their experience; all developers building on HeadyIO; the Heady core team deploying new capabilities.

**Cost of not solving it:** Platform stagnation; no developer ecosystem; inability to deliver personalized capability surfaces; monolithic deployment risk; direct competitive disadvantage versus Anthropic's MCP marketplace and OpenAI's plugin ecosystem.

---

## 2. Goals

| Goal | Measurement | Target |
|---|---|---|
| Any registered module can be discovered and installed in ≤ 3 interactions | Installation funnel completion rate | ≥ 80% |
| Modules deliver to correct surface and context without manual configuration | % of dynamic deliveries with correct surface targeting | ≥ 99% |
| Third-party developers can publish a module through HeadyIO | Module publish → approval → available to users cycle time | ≤ 48 hours (reviewed), ≤ 5 minutes (auto-approved for trusted devs) |
| Module updates roll out without disrupting active sessions | Zero-downtime module update rate | ≥ 99.5% |
| Registry latency: module resolution at request time | p99 module resolution latency | < 100ms |

---

## 3. Non-Goals

- **Not a general app store.** The registry delivers Heady-native modules (skills, connectors, UI widgets, automations); it does not distribute third-party apps outside the Heady context.
- **Not a billing/monetization marketplace in v1.** Paid module distribution is a future capability; v1 handles free and trusted modules.
- **Not a CDN for large binary assets.** Module manifests and lightweight scripts only; large model weights or media are out of scope.
- **Not a package manager for arbitrary code.** Modules must conform to the Heady module schema; arbitrary NPM packages or Python wheels are not directly installable.

---

## 4. User Stories

### Discovery and Installation

- **As a Heady user**, I want to browse available modules categorized by capability (research, writing, coding, automation), so that I can find useful extensions without knowing their exact names.
- **As a Heady user**, I want to search the registry by keyword or capability, so that I can quickly find a specific skill or connector I have heard about.
- **As a Heady user**, I want to install a module with one click and have it immediately available in my active work area, so that I can start using it without reloading or reconfiguring.
- **As a Heady user**, I want to see which modules are currently installed and which are active in each work area, so that I have full visibility into my capability set.

### Developer Publishing

- **As a developer on HeadyIO**, I want to define a module manifest (name, version, permissions, surfaces, entry point) and publish it to the registry, so that Heady users can discover and install my module.
- **As a developer**, I want to push a new version of my module and have it roll out to existing installers progressively, so that I can ship updates without disrupting users.
- **As a developer**, I want to receive install counts and error rate telemetry for my published modules, so that I can understand adoption and reliability.

### Dynamic Delivery

- **As a Heady system component**, I want to query the registry for modules relevant to the current user context and surface, so that the UI and agent can compose capabilities dynamically without hardcoded imports.
- **As a HeadyBuddy session**, I want to auto-load context-appropriate modules based on the active work area and current task, so that relevant skills are available without explicit user action.

---

## 5. Requirements

### P0 — Must Have

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| LMR-001 | Module manifest schema: name, version (semver), description, module_type (skill/connector/ui_widget/automation), surfaces[], permissions[], entry_point, author | Given a manifest is submitted, Then the registry validates it against the schema before accepting |
| LMR-002 | Registry API: endpoints for list, search, get, install, uninstall, update | Given a GET /registry/modules?q=research, Then results include matching modules with name, type, and install count |
| LMR-003 | Installation: binding a module to a user and optionally a work area | Given user installs module M into area A, Then M is available in that area on all surfaces within 10 seconds |
| LMR-004 | Version management: registry supports multiple versions; installs track pinned version | Given module M has v1.2 and v1.3, When a user installs, Then v1.3 (latest stable) is installed; user can pin to v1.2 |
| LMR-005 | Module resolution at runtime: surfaces query registry for installed modules at session start | Given area A has 3 installed modules, When a Buddy session starts in area A, Then all 3 modules are loaded into context |
| LMR-006 | Permission-required modules: modules with permission requirements prompt the user for grant approval on install | Given module M requires gmail:read, When user installs, Then a permission grant dialog is shown and must be approved before installation completes |
| LMR-007 | Module uninstall: removes module from user/area installation and revokes associated grants | Given user uninstalls module M, Then M is unavailable within 10 seconds and associated grants are revoked |

### P1 — Should Have

| ID | Requirement |
|---|---|
| LMR-008 | Developer publish flow: manifest upload → automated schema validation → review queue → publish |
| LMR-009 | Progressive rollout: new module versions roll out to % of installed base, configurable by author |
| LMR-010 | Registry UI: browsable, searchable module catalog embedded in headyme.com |
| LMR-011 | Module ratings and reviews by users |
| LMR-012 | Context-aware auto-suggestion: registry suggests relevant modules based on active work area type and current task |
| LMR-013 | Module telemetry dashboard for developers: install count, error rate, version distribution |

### P2 — Future Consideration

| ID | Requirement |
|---|---|
| LMR-014 | Paid/premium module tiers with billing integration |
| LMR-015 | Enterprise private registry: organizations publish internal-only modules |
| LMR-016 | AI-powered module curation: auto-generates collections based on user behavior |

---

## 6. User Experience

### Module Registry Browser (headyme.com)

```
┌─────────────────────────────────────────────────────────┐
│  MODULE REGISTRY               [🔍 Search modules...]   │
│─────────────────────────────────────────────────────────│
│  Categories: [All] [Research] [Writing] [Code] [Auto]   │
│                                                          │
│  ★ Featured                                             │
│  ┌──────────────────────┐  ┌──────────────────────┐    │
│  │ Deep Research Pack   │  │ GitHub Connector Pro │    │
│  │ Skills: 5 | Type: Bundle│ │ Type: Connector      │    │
│  │ ⭐4.8 | 2,341 installs│  │ ⭐4.6 | 1,102 installs│    │
│  │ Needs: web:read       │  │ Needs: github:read/  │    │
│  │ [Install ▶]           │  │ write  [Install ▶]   │    │
│  └──────────────────────┘  └──────────────────────┘    │
│                                                          │
│  INSTALLED (7)                                [Manage]  │
│  ✓ Python Expert Skill  v2.1  [Update to v2.2] [Remove] │
│  ✓ Notion Connector     v1.4  [Up to date]     [Remove] │
└─────────────────────────────────────────────────────────┘
```

### Install Flow

1. User selects module → sees description, permissions required, version, author
2. Permission grant prompt (if required): review scopes → Approve / Cancel
3. Work area selector: "Install in all areas" / "Install in [specific area]"
4. Install confirmation → module available immediately
5. Success state: "Python Expert Skill is now active in your Work: Acme area"

---

## 7. Architecture

### Module Manifest Schema

```json
{
  "module_id": "uuid",
  "slug": "heady-python-expert",
  "name": "Python Expert Skill",
  "version": "2.1.0",
  "module_type": "skill | connector | ui_widget | automation | bundle",
  "description": "string",
  "author": {
    "id": "string",
    "name": "string",
    "verified": true
  },
  "surfaces": ["buddy", "ide", "web"],
  "permissions_required": [
    { "resource": "github", "actions": ["read"] }
  ],
  "entry_point": {
    "type": "worker_url | mcp_endpoint | skill_md_url",
    "url": "https://..."
  },
  "dependencies": ["module_id_1"],
  "min_heady_version": "2.0.0",
  "tags": ["python", "code", "ide"],
  "published_at": "ISO8601",
  "status": "active | deprecated | review"
}
```

### Registry Architecture

```
┌──────────────────────────────────────────────────────────┐
│                   Liquid Module Registry                  │
│                                                          │
│  ┌──────────────┐  ┌─────────────────┐  ┌────────────┐ │
│  │  Registry DB │  │  Install Store  │  │ Resolution │ │
│  │  (D1)        │  │  (D1, per user) │  │ Cache      │ │
│  │  modules,    │  │  user_id,       │  │ (KV, edge) │ │
│  │  versions,   │  │  module_id,     │  │            │ │
│  │  manifests   │  │  area_id,       │  └────────────┘ │
│  └──────────────┘  │  version_pinned │                 │
│                    └─────────────────┘                  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │           Registry API (Cloudflare Workers)      │   │
│  │  GET /registry/modules    POST /registry/install  │   │
│  │  GET /registry/resolve    DELETE /registry/install│   │
│  │  POST /registry/publish   GET /registry/installed │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

### Data Flows

**Module Install:**
```
User selects install → POST /registry/install
→ Validate: module exists, user has permission to install, scope grants approved
→ Write installation record to D1 (user_id, module_id, area_id, version)
→ Invalidate resolution cache for user/area
→ Return success; UI updates installed list
```

**Session Module Resolution:**
```
Session start → GET /registry/resolve?user_id=X&area_id=Y&surface=buddy
→ Check KV cache (TTL 60s)
→ On miss: query D1 for installed modules for user + area + surface
→ Return array of module manifests
→ Session loads entry points and makes them available to agent/UI
→ Write to KV cache
```

**Developer Publish:**
```
Developer POST /registry/publish (manifest + entry_point)
→ Schema validation → fail fast with errors
→ If trusted author: auto-approve → status = active
→ If unverified: status = review → enter queue
→ Review team approves → status = active → module visible in registry
→ Webhook notification to developer
```

---

## 8. Security and Privacy

| Concern | Mitigation |
|---|---|
| Malicious module published to registry | All modules reviewed before activation; trusted author whitelist for auto-approve; sandboxed execution environment |
| Module entry point compromise (supply chain attack) | Entry point URLs are pinned at install time; integrity hash required for Worker-based modules |
| Permission grant abuse via module | Modules can only request permissions at install time; no runtime permission escalation |
| Registry API abuse | Rate limiting on install/publish endpoints; authenticated endpoints only |
| Data exfiltration via module | All module network calls go through Heady proxy; unrestricted external calls are a P2 concern |
| Module version rollback to vulnerable version | Deprecated versions are marked; install of deprecated versions requires explicit override |

---

## 9. Dependencies

| Dependency | Owner | Risk |
|---|---|---|
| Permission Graph (HEADY-FEAT-001) for install-time grant | Permission team | High — grant on install requires Vault |
| Work-Area Orchestrator (HEADY-FEAT-003) for area scoping | Work area team | High — area-scoped install requires area model |
| Cloudflare KV for resolution cache | Infrastructure | Low |
| headyme.com Registry UI | HeadyMe | Medium |
| HeadyIO developer portal | HeadyIO | High — developer publish flow lives here |
| MCP layer module loading | HeadySystems | High — modules must be loadable at session start |

---

## 10. Phased Rollout

### Phase 1 — Foundation (Weeks 1–4)
- Module manifest schema and validation
- Registry DB (D1) + Registry API (list, get, install, uninstall)
- Installation record store
- Session resolution API + KV cache
- Internal modules published (first-party skills and connectors migrated to registry)

### Phase 2 — UI and Discovery (Weeks 5–8)
- Registry Browser UI on headyme.com
- Installed modules view
- Search and category filtering
- Permission grant dialog on install

### Phase 3 — Developer Platform (Weeks 9–14)
- Developer publish flow on HeadyIO
- Auto-approval for trusted developers
- Review queue for unverified publishers
- Developer telemetry dashboard
- Progressive rollout for version updates

### Phase 4 — Intelligence (Weeks 15+)
- Context-aware module suggestions
- Module ratings and reviews
- Bundle module type (multiple modules packaged together)
- Private registry for enterprise

---

## 11. Success Metrics

| Metric | Target (60 days post-launch) |
|---|---|
| Modules published by third-party developers | ≥ 10 within 30 days of developer platform launch |
| Average installs per active user | ≥ 3 modules installed |
| Module resolution p99 latency | < 100ms |
| Install funnel completion rate | ≥ 80% |
| Post-install session engagement (users who use installed module within 7 days) | ≥ 65% |

---

## 12. Open Questions

| Question | Owner | Blocking? |
|---|---|---|
| Should bundle modules be installed atomically (all or nothing) or allow partial install? | Product / Engineering | No — atomic in v1 |
| What is the maximum number of installed modules per work area? | Engineering | No — recommend 20; adjust based on performance |
| Should module entry points be allowed to be external URLs or must they be hosted on Heady infrastructure? | Security / Product | Yes — v1: only Heady-hosted Worker URLs; external URLs in v2 |
| How are module conflicts (two modules exposing the same skill name) resolved? | Product | No — last-installed wins; surface conflict warning |
| What telemetry data is collected per module install/use, and what is disclosed to module authors? | Legal / Product | Yes — privacy disclosure required |
