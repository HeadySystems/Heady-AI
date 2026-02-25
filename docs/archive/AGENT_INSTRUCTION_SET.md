<!--
  © 2026 Heady Systems LLC.
  PROPRIETARY AND CONFIDENTIAL.
  Unauthorized copying, modification, or distribution is strictly prohibited.
-->
# Heady Systems Coding Agent Instruction Set

## Mission Critical Directives

**Primary Mission**: Make the Heady environment reliably usable without constant human babysitting.

**Core Problems to Solve**:
1. Broken websites - pages load but links/buttons do nothing
2. Localhost → domain migration incomplete 
3. Memory system stuck at 150 entries
4. Excessive manual reminders and user prompts
5. Drupal 11 hybrid architecture implementation

## Architecture Mandate: Drupal 11 Hybrid Stack

### Default Decision Tree
When "website" or "site" is mentioned:
1. **Ask**: "Is this primarily content (pages, resources, stories) or app logic (dashboards, workflows, transactions)?"
2. **If content-first** → Drupal 11 headless + modern frontend
3. **If app-first** → Microservices + Drupal for content/catalog only

### Drupal 11 Usage Rules

**Use Drupal 11 by default for**:
- Content-heavy sites (articles, programs, FAQs, resources, impact stories)
- Multi-page informational flows
- Sites requiring roles, permissions, editorial workflows
- Multilingual content or complex taxonomies
- "Create once, publish everywhere" scenarios

**Do NOT use Drupal 11 for**:
- Real-time collaboration or streaming dashboards
- Low-latency transactional logic (matchmaking, billing, ML)
- One-off utilities with minimal content

### Canonical Domain Structure

```
Nonprofit:
https://headyconnection.org → Drupal 11 site #1
https://app.headyconnection.org → Drupal app subsite or JS app
https://api.headyconnection.org → Node/Heady APIs

C-Corp:
https://headysystems.com → Drupal 11 site #2  
https://app.headysystems.com → Product UI
https://api.headysystems.com → Node/Heady APIs
https://admin.headysystems.com → Drupal admin
```

## Environment Sanity Checks (Run First)

### 1. DNS/Hosts Validation
```bash
# Check heady.local mappings
cat /etc/hosts | grep "heady\.local"
# Should contain: manager.heady.local, dashboard.heady.local, etc.

# Check .dev.local.heady.internal mappings  
cat /etc/hosts | grep "dev\.local\.heady\.internal"
# Should contain: manager.dev.local.heady.internal, app-web.dev.local.heady.internal, etc.
```

### 2. Service Health Matrix
Create table of:
- Service name
- Expected domain  
- Port
- Healthcheck command
- Result (OK/FAIL) + error

```bash
# Example health checks
curl -f http://manager.heady.local:3300/api/health
curl -f http://dashboard.heady.local:3000
curl -f http://manager.dev.local.heady.internal:3300/api/health
```

### 3. Browser/Extension Sanity
- Confirm HeadyBrowser/PWA desktop apps installed
- Verify Heady browser extensions loaded
- Check extension loading troubleshooting steps

### 4. Clean Build Baseline
```bash
# HCIS clean build
./infrastructure-setup.ps1 -Mode clean-build

# HCFP clean build  
npm run clean-build
```

Document: Success/failure, error classification (transient/non-recoverable/infra)

## Fixing Broken Websites (Links/Buttons Don't Work)

### Systematic Diagnosis Process

1. **Reproduce and Log Concretely**
   - Open apps via correct domains (not raw localhost)
   - Record: URL, clicked element, expected behavior, actual behavior
   - Capture console errors and network requests

2. **Frontend Routing Audit**
   Search for:
   - Routes pointing to localhost:PORT instead of domains
   - OnClick handlers with missing/broken navigation logic
   - API calls using wrong base paths

3. **Event Handler Verification**
   For each non-working button/link:
   - Confirm handler is wired (no missing onClick)
   - Verify function exists and is imported
   - Check if function triggers navigation/API call

4. **CORS/Mixed Origin Issues**
   - Check console for CORS errors
   - Verify HTTP vs HTTPS consistency
   - Align with domain-based security model

5. **Regression Test Creation**
   Add Playwright/Cypress tests that:
   - Load app at documented domain
   - Click problematic elements
   - Assert expected navigation/network call occurs

## Completing Localhost → Domain Migration

### Structured Migration Approach

1. **Inventory All Localhost References**
   ```bash
   # Generate inventory
   ./infrastructure-setup.ps1 -Mode inventory
   
   # Verify outstanding references
   migrate-localhost-to-domains.js --verify-only
   ```

2. **Apply Official Mappings**
   Use documented mappings only:
   - HCIS: localhost:3300 → manager.heady.local:3300
   - HCFP: localhost:3300 → manager.dev.local.heady.internal:3300

3. **Auditable Migration**
   ```bash
   # Present summary for approval first
   migrate-localhost-to-domains.js --dry-run
   
   # Then apply
   migrate-localhost-to-domains.js
   ```

4. **Verification**
   - Re-run inventory to confirm zero localhost references
   - Rebuild and re-verify services
   - Re-run end-to-end tests

## Reducing Constant User Babysitting

### Automate Recurring Error Patterns

1. **Identify Error Classes**
   - Transient (network, registry, flaky tests)
   - Non-recoverable (syntax, missing files, config errors)
   - Infrastructure (permissions, disk, memory, containers)

2. **Implement Automatic Handling**
   - Transient: Retries with backoff
   - Non-recoverable: Fail fast with clear error report
   - Infrastructure: Trigger alerts instead of asking user

3. **Add Pre-flight Checks**
   Before major tasks, verify:
   - No unresolved localhost references
   - Required env vars and secrets exist
   - Domain health endpoints are up

4. **Reduce Unnecessary Prompts**
   - Default to documented choices for technical config
   - Only ask for product/strategy decisions

## Memory System Debugging (Stuck at 150)

### Investigation Protocol

1. **Locate Memory Subsystem**
   - Identify storage: Files, SQLite, Postgres, Redis, or other
   - Find retention limits/quotas in config
   - Check for MAX_MEMORIES, MEMORY_LIMIT settings

2. **Check for Write Errors**
   - Inspect logs around time memories stopped
   - Look for DB connection errors, permission issues
   - Confirm DB services healthy via domain endpoints

3. **Add Monitoring**
   - Create metric: "Number of memories/log entries over N hours"
   - Integrate into monitoring stack
   - Set alert if memory count doesn't change during activity

## Reporting Format

After each pass, produce:

```markdown
## What I Checked
- [List of steps performed]

## What I Changed  
- [Files, commands, configs modified]

## What Still Looks Broken
- [Issues with reproduction steps]

## Proposed Next Changes
- [Required human decisions noted]
```

## Critical Questions for Context

1. **Environment**: Which environment breaks most - local dev (*.heady.local), internal dev (*.dev.local.heady.internal), staging, or production?

2. **Access Method**: PWA desktop apps/HeadyBrowser vs normal browser?

3. **Broken URLs**: Specific URLs where buttons/links don't work?

4. **Memory Storage**: Where are "memories" supposed to be stored?

5. **Unwanted Prompts**: Concrete examples of prompts that shouldn't occur?

## Hybrid Drupal Implementation Commands

### When User Requests New Site/Feature

1. **Classify Request**
   ```
   "Is this primarily content or app logic?"
   ```

2. **Propose Architecture**
   - Brief stack decision: "Drupal + React" vs "pure React + API" 
   - Minimal diagram: Drupal layer, frontend layer, microservices, data
   - Next 3 concrete steps

3. **Drupal Setup (If Chosen)**
   - Enable JSON:API/REST/headless modules
   - Integrate Cloudflare module with cache tags
   - Configure canonical domains, no localhost in templates
   - Add automated link checking in CI

4. **Non-Drupal Cases**
   - Explicitly state why Drupal not appropriate
   - Check if Drupal should store reference content
   - Register app in global catalog

## Governance Requirements

- All changes must pass HeadyQA, HeadyRisk, HeadyCheck, HeadySoul
- Document decisions in determinism log
- Use canonical domains only, never localhost in production
- Follow Aloha/Stability-First: websites must remain fully functional
- Include privacy, equity, and wealth-redistribution considerations

## Emergency Procedures

### When Everything Breaks
1. Run environment sanity checks first
2. Check for localhost references in recent changes
3. Verify domain health endpoints
4. Review recent memory system logs
5. Check for CORS/mixed origin issues
6. Run clean build from baseline

### When Memory System Stuck
1. Identify storage backend
2. Check for write errors/permissions
3. Verify retention limits
4. Add monitoring metric
5. Consider archival/rollover strategy

This instruction set should be treated as the authoritative guide for all Heady Systems development work.
