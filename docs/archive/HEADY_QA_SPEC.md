<!--
  © 2026 Heady Systems LLC.
  PROPRIETARY AND CONFIDENTIAL.
  Unauthorized copying, modification, or distribution is strictly prohibited.
-->
# HeadyQA (Quality Assurance Orchestrator) Specification

Version: 1.0.0  
Owner: core / qa-governance  
Status: draft

## 1. Purpose

HeadyQA is the central Quality Assurance orchestrator for Heady Systems.

It does not run tests itself. Instead, it:
- Assembles and triggers the right test/check suites
- Aggregates and interprets their results  
- Produces a single QA verdict per pipeline run, PR, or manual request

HeadyQA is a required input to:
- HeadyCheck (gating)
- HeadyRisk (risk vector)  
- MC + Pattern Engine + Self-Critique (learning from QA outcomes)

## 2. Scope

HeadyQA MUST be invoked for:

### 2.1 Pipeline Runs
All HCFullPipeline runs that:
- Target `main`, `production`, or any environment mapped to cloud layers
- Affect auth, data flows, or financial/impact ledgers

### 2.2 Pull Requests  
All PRs that:
- Touch `configs/`, `render.yaml`, `hcfullpipeline.yaml`, or `heady-registry.json`
- Change HeadyBuddy, HeadyBrowser, or cross-platform routing behavior

### 2.3 Manual High-Risk Changes
Any change flagged by HeadyRisk or HeadySoul as high-risk

## 3. Inputs (Signals)

HeadyQA consumes:

### 3.1 Test Suites
- **Unit tests**: Language-specific test runners
- **Integration tests**: 
  - `domain-connectivity-tests` (DNS, ports, localhost migration, security classifications)
  - API integration suites
- **Security tests**:
  - MURPHY / SecurityAudit tool outputs (semgrep-based)
  - Trivy or equivalent container scans (via Clean-Build CI)

### 3.2 Readiness & Health
- Operational Readiness Score (ORS 0–100) computed from probes
- Channel health metrics from Connection Integrity (latency per channel)
- Service health endpoints (`/api/health`, `/api/pulse`, pipeline state)

### 3.3 Documentation & Drift
- Checkpoint Protocol status: Docs, configs, registry, notebooks all synced at checkpoints
- ATLAS doc generation results (missing/failed sections)

### 3.4 User / Stakeholder Feedback (Optional)
- Structured feedback from beta testers, internal QA, support
- StoryDriver narratives flagged as "incident" or "degradation"

## 4. Outputs

HeadyQA returns a canonical QA result:

```json
{
  "status": "pass" | "pass-with-warnings" | "fail",
  "summary": "short human-readable summary", 
  "issues": [
    {
      "id": "qa-1234",
      "category": "functional" | "performance" | "security" | "docs" | "infra",
      "severity": "low" | "medium" | "high" | "critical", 
      "description": "...",
      "location": "repo/file:test-case-or-endpoint",
      "suggested_fix": "..."
    }
  ],
  "metrics": {
    "tests_total": 0,
    "tests_failed": 0,
    "coverage_pct": 0,
    "latency_p95_ms": 0,
    "ors_score": 0
  }
}
```

This object is:
- Attached to determinism_log rows for the run
- Passed to HeadyCheck and HeadyRisk
- Available via API and StoryDriver for transparency

## 5. API

### 5.1 Run QA
```
POST /api/qa/run
Input: { "task_type": "...", "change_set": [...], "environment": "..." }
Behavior: Triggers relevant test/check suites and aggregates results
Output: QA result object
```

### 5.2 Get History
```
GET /api/qa/history?task_type=...
Returns: Historical QA results and trends for given task type
```

### 5.3 Get Status
```
GET /api/qa/status?run_id=...
Returns: Real-time progress and partial results
```

HeadyQA MUST be callable from:
- HCFullPipeline Stage 3–4 (Execute/Recover) and Stage 6 (Optimize) as part of improvement loop
- CI workflows (GitHub Actions, etc.) as a step in clean-build pipelines

## 6. Integration with HCFullPipeline

### Stages Integration
- **Stage 2 Plan (MC)**: HeadyQA MAY estimate test impact/coverage for candidate plans
- **Stage 3 Execute**: After main execution, HeadyQA runs tests
- **Stage 4 Recover**: On failures, HeadyQA records root-cause clues and feeds Self-Critique and Patterns
- **Stage 5 Self-Critique / Stage 6 Optimize**: Self-Critique uses QA issues to propose process improvements; Pattern Engine learns which ensembles tend to pass or fail QA
- **Stage 7 Finalize**: HeadyQA result is baked into release notes and governance records

### Mandatory Inputs
HeadyQA's outputs are mandatory inputs for:
- HeadyCheck decisions
- HeadyRisk risk vectors

## 7. Test Suite Orchestration

### 7.1 Domain Connectivity Tests
For every change:
- DNS resolution for all required domains
- Port accessibility checks
- Localhost reference validation
- Security classification verification

### 7.2 Frontend Functionality Tests
For web/app changes:
- Page load tests via canonical domains
- Link/button click interaction tests
- Form submission and validation tests
- Cross-browser compatibility checks

### 7.3 API Integration Tests
For backend changes:
- Endpoint accessibility via domains
- Request/response validation
- Authentication and authorization tests
- Rate limiting and abuse protection tests

### 7.4 Security Scans
For all changes:
- Static code analysis (MURPHY/semgrep)
- Container vulnerability scans (Trivy)
- Dependency vulnerability checks
- Configuration security audits

### 7.5 Performance Tests
For significant changes:
- Latency measurements vs Connection Integrity targets
- Load testing for expected traffic
- Resource utilization monitoring
- Memory leak detection

## 8. Quality Gates and Thresholds

### 8.1 Pass Criteria
- All critical and high severity issues resolved
- Test coverage ≥ 80% for new code
- Performance within Connection Integrity targets
- Security scan results below risk thresholds
- Documentation complete and accurate

### 8.2 Pass-With-Warnings Criteria
- Medium severity issues acceptable with mitigation plan
- Test coverage 60-79% with improvement timeline
- Minor performance deviations with optimization plan
- Low severity security issues with patch schedule

### 8.3 Fail Criteria
- Any critical severity issue
- Security vulnerabilities above risk threshold
- Test coverage < 60%
- Performance significantly below targets
- Missing or inaccurate documentation
- Broken links or non-functional UI elements

## 9. Error Classification and Handling

### 9.1 Issue Categories
- **Functional**: Features don't work as specified
- **Performance**: Slow response times, high resource usage
- **Security**: Vulnerabilities, misconfigurations
- **Documentation**: Missing, inaccurate, or outdated docs
- **Infrastructure**: Deployment, scaling, or reliability issues

### 9.2 Severity Levels
- **Critical**: Blocks deployment, major security risk, data loss potential
- **High**: Significant functional impact, security concern, user experience degradation
- **Medium**: Minor functional impact, performance issue, documentation gap
- **Low**: Cosmetic issue, minor documentation error, optimization opportunity

### 9.3 Suggested Fix Format
Each issue must include:
- Clear description of problem
- Steps to reproduce
- Expected vs actual behavior
- Specific fix recommendation
- Files/lines involved where applicable

## 10. Integration with Governance

### 10.1 Required Checks
All changes must pass:
- HeadyQA-QA (quality assurance)
- HeadyRisk (risk assessment)  
- HeadyCheck (final gate)
- HeadySoul (mission alignment)

### 10.2 Documentation Requirements
- QA results stored in determinism_log
- Issues tracked in project management system
- Trends and metrics reported to stakeholders
- Learning fed back to Pattern Engine and MC

### 10.3 Continuous Improvement
- Analyze QA failure patterns
- Update test suites based on incidents
- Refine thresholds and criteria
- Improve automation and coverage

## 11. Monitoring and Alerting

### 11.1 QA Metrics Dashboard
- Pass/fail rates over time
- Issue severity distribution
- Test coverage trends
- Performance metrics
- Security scan results

### 11.2 Alert Conditions
- QA failure rate > 10% over 24 hours
- Critical security issues detected
- Performance degradation > 20%
- Test coverage drop > 15%
- Documentation completeness < 85%

### 11.3 Reporting
- Daily QA summary reports
- Weekly trend analysis
- Monthly governance review
- Incident post-mortems with QA findings

## 12. Configuration and Customization

### 12.1 Environment-Specific Rules
- Development: Relaxed thresholds, fast feedback
- Staging: Production-like rules, comprehensive testing
- Production: Strictest gates, full validation

### 12.2 Project-Specific Customization
- Custom test suites for specialized components
- Adjusted thresholds for different risk profiles
- Additional documentation requirements
- Project-specific performance targets

### 12.3 Integration Points
- CI/CD pipeline hooks
- Project management system integration
- Monitoring and alerting systems
- Documentation and knowledge bases

---

**Related Documents**:
- `HEADY_RISK_SPEC.md`
- `MULTI_AGENT_TRANSPARENCY.md` 
- `ITERATIVE_REBUILD_PROTOCOL.md`
- `HCFullPipeline v3.0.0` design docs
- `AGENT_INSTRUCTION_SET.md`
