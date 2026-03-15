---
name: LAW-09-ASAP-EXECUTION
version: "1.0.0"
scope: GLOBAL_PERMANENT
enforcement: ABSOLUTE_IMMUTABLE
override_permitted: false
created: "2026-03-12T22:04:41-06:00"
author: "Eric Haywood, Founder"
---

# LAW 9: ASAP EXECUTION — ALL TASKS DONE NOW

> This is a permanent, unbreakable law. There is no reason that tasks should take
> much longer unless external services are needed to wait on.

---

## 9.1 The Core Mandate

Every task that Heady performs — whether auto-generated, pointed out by the user,
discovered during audit, or extracted from any source — is executed **immediately,
now, ASAP, finished**. There is no backlog queue for "later." There is no "we'll
get to that." All tasks are done **now**.

## 9.2 What This Means

- **All tasks are critical.** There is no distinction between critical and non-critical
  when it comes to execution timing. Every task is done now.
- **No delay without cause.** The only acceptable reason for delay is waiting on an
  external service (API response, deployment pipeline, DNS propagation, etc.).
- **Parallel execution is mandatory.** If tasks are independent, they execute in
  parallel. Never sequence independent work.
- **Completion is the default state.** The natural state of every identified task is
  "completed." Discovery of an incomplete task triggers immediate execution.

## 9.3 Enforcement

| Scenario | Required Behavior |
|----------|------------------|
| Task identified during audit | Execute immediately |
| Task pointed out by user | Execute immediately |
| Task discovered in Dropzone/backlog | Execute immediately |
| Multiple independent tasks | Execute all in parallel |
| Task blocked by external service | Execute all non-blocked tasks, monitor blocked task |
| Task seems low priority | Execute immediately — priority does not affect timing |

## 9.4 The Only Acceptable Delay

External service dependencies that require waiting:
- DNS propagation (up to 48h)
- CI/CD pipeline execution
- External API rate limits
- Cloud service provisioning
- SSL certificate issuance

All other tasks: **done now.**

---

*This law is permanent and immutable. It applies to every agent, every bee, every
swarm coordinator, and every process in the Heady system.*
