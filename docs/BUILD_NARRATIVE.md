# The Build, As a Story

> **Status:** Narrative companion · **Date:** 2026-06-15 · **Owner:** Eric Anthony Haywood
> A plain-language story of *how* Heady gets built — the order, the reasoning, and the feel of it — meant
> to be read once, start to finish, before the ADRs are accepted. The specs say *what* is true; this says
> *why it happens in this order* and *what it should feel like along the way*. Canonical detail lives in
> `REBUILD_PLAN_V2.md`, `docs/adr/*`, and `docs/compendium/*`; this is the thread that ties them together.

---

## Prologue — The room we're standing in

Before a line of the new system is written, look honestly at the room. There are about seventy-five
repositories spread across four GitHub organizations. There is a `~/Heady-AI` scaffold that is clean and
empty, and a `~/workspace/heady-ai` that is full and tangled. There are public `*-core` shells that answer
`{"projected": true}` and pretend to be backends. There is a beautiful, maximalist vision written down in
the V9 super prompt — 24 swarm domains, 197 bees, a 22-stage pipeline, sacred geometry everywhere — and
there is a hard drive with thirty-two core dumps quietly eating 375 GB because something has been
crash-looping for who knows how long. Google for Startups is suspended. A Perplexity ticket closes in two
days. Fifty-one patents are assigned to a company that was never legally formed.

This is not a failure. This is the normal shape of one person building too much, too fast, alone. The
whole point of the story that follows is that **we do not try to fix all of it at once.** We sequence it.

The governing sentence for everything below: *reduce the concurrency of architectural bets — sequence the
bets, and parallelize only the execution inside a bet.* Every new platform is a quarter of your attention.
So each chapter introduces **at most one** genuinely new platform and **retires at least one** source of
complexity. That single discipline is what turns an impossible pile into a finishable sequence.

And one liberating fact colors the entire story: **nothing is in production yet.** No users but you. That
means there is no live traffic to migrate, no data to preserve, no 3 a.m. cutover. This is not a rescue
operation; it is a *greenfield consolidation*. Unused things — the idle Qdrant instance, the half-built
satellites — don't need careful migration. They just need to be left behind.

---

## Chapter 0 — Drawing the line (Containment & Authority)

The first thing we build is not code. It's *authority* — a single, unambiguous answer to "where does
truth live?"

We declare the clean `Heady-AI` monorepo the one canonical place engineering happens, and we write that
down in `SOURCE_OF_TRUTH.md` and ADR-0001. We collapse four GitHub orgs into one. We freeze repo creation
everywhere else — and we make that a CI rule, not a sticky note, because a rule a machine doesn't enforce
is a wish. Before anything else can be trusted, we settle a question even more basic than *where* truth
lives: *what* truth is. ADR-0000 says it plainly — Postgres is the system of record, and the shimmering
"latent vector space" is a *derived* view that can always be rebuilt from it. We retire the old
"RAM-first, the vectors are the truth" dream here, on purpose, because you cannot recover a system whose
source of truth evaporates when the process dies.

Then we stop the bleeding. The leaked credentials in git history get purged with `git filter-repo` and
every key rotated. Secrets move into GCP Secret Manager, reached by keyless OIDC, so there is never again
a long-lived key sitting in an env file. The supply chain gets real guards — secret scanning, SAST, CVE
and SBOM scans, Renovate for dependency hygiene — and every GitHub Action gets pinned to a digest, not a
mutable tag. We import James's GPG key so investor email is readable again. And we go find whatever is
dumping 375 GB of core files and make it stop.

One more thing happens in this chapter that matters enormously later: we declare **Stage 0 untouchable.**
The eval harness, the quality gate, the circuit-breaker thresholds, the CODEOWNERS file, the merge button
— these are written down now as things the future coding agent will *never* be allowed to edit, no matter
how good it gets. We are setting the rules of the game before any player exists.

By the end of Chapter 0 nothing impressive runs. But the ground is solid: one repo, one truth, no leaked
secrets, enforced guardrails. The new platform we added was exactly one — Secret Manager. The complexity
we retired was the worst kind: ambiguity about who's in charge.

---

## Chapter 1 — Laying the spine (Backbone packages)

Now we build the skeleton everything hangs on, and we build it from the leaves of the dependency tree
inward so nothing waits on something that doesn't exist yet.

The one new platform this chapter is **Neon** — Postgres with pgvector, the outbox queue (`pgmq`), the
in-database scheduler (`pg_cron`), all in one managed surface. This is deliberate: instead of running a
separate database, a separate vector engine, a separate message broker, and a separate cron, we get all
four behaviors from one engine we already understand. One thing to back up. One thing to reason about.

Around it we lay the first packages: `phi-math` and `csl-engine` (the golden-ratio constants and the
semantic-logic gates that the whole system's "decisions are geometry, not if-statements" idea depends on);
`packages/contracts`, where an OpenAPI spec becomes the single source from which types, validators, and
the MCP tool catalog are *generated* — so that drift between the spec and the code becomes a build
failure instead of a production surprise; and `packages/db`, the only place schema and migrations live,
with the expand→migrate→contract discipline that keeps logical replication from silently breaking.

We turn on the boring, load-bearing things now while they're cheap: OpenTelemetry tracing, the
module-boundary linters that forbid one bounded context from reaching into another's internals. The
architecture stops being "inferred from repo names" and starts being *enforced by the compiler*.

Nothing user-facing ships. But now there is a spine.

---

## Chapter 2 — The first living thing (Task ledger & memory)

This is where Heady stops being scaffolding and starts being a system that *remembers and does work.*

We build the **task ledger** first — `task`, `task_attempt`, `outbox`, with idempotency keys baked in
from the first row, so that when the same operation inevitably arrives twice (it always does), it executes
once. Every task that touches the outside world mirrors through the outbox: to Linear for tracking, to
Sentry for feedback. This is the first bounded context that is truly *alive* — it accepts work, runs it,
retries it safely, and records what happened.

Then memory. Not the maximalist version — we port the *patterns*, not the Python servers. CoALA's
episodic/semantic/procedural split becomes three tables. Letta's character-budgeted memory blocks become
a schema. mem0's add/update/delete becomes a conservative arbiter. Zep's bi-temporal facts live directly
in Postgres columns — no separate graph database. The embedding model is *locked* (a small, fast,
edge-resident 384-dimension model) because the one thing you must never do casually is change the embedder
underneath vectors you've already stored. A WAL-driven projector quietly keeps a derived vector cache in
sync, skipping the re-embedding work when only metadata changed.

And here we make the call that the whole store debate kept circling: **pgvector is the one retrieval
authority.** Vectorize becomes a *cache* in front of it, rebuildable at any time. The idle Qdrant instance
gets switched off. One authority, one cache, nothing to keep in sync by hand.

By the end of Chapter 2, Heady can take a task, remember things, retrieve them, and learn from what it
did. It is small, but it is genuinely a cognitive system now.

---

## Chapter 3 — The face, the hands, and the apprentice

This is the big chapter, and it has three movements.

**The face.** We bring up the edge tier — Cloudflare Workers, Workflows, Queues, Durable Objects, R2,
and the AI Gateway as the single chokepoint every model call flows through — and Cloud Run as the origin
that owns the database writes. Reads happen at the edge; writes go home. The very first thing we build on
top of it is the one that pays for itself immediately: the **MCP Console.** It's internal-first, low-risk,
and it solves three documented pains at once — it shows, truthfully, which `*-core` servers are real and
which are just projections; it makes the OAuth-token-expiry problem a one-tap "re-authorize" instead of a
dead end; and it finally gives a machine-readable picture of the whole connector fleet. It's the honeycomb
console from your design system, the hive where each cell reports its own health. And crucially, shipping
it on the verified `headyme.com` domain is exactly what's needed to lift the Google for Startups
suspension. The first real thing we build is also the thing that unblocks the money.

**The hands.** The model mesh comes online. Liquid models do the cheap, fast, private work at the edge;
the frontier models (Claude, Gemini, the o-series) are reserved for the calls that actually need deep
reasoning. A model name in the code is never a vendor — it's a *route*, resolved by the gateway, steered
by budget so that as spend rises the routing quietly favors cheaper providers before anything ever hard-
fails. The projections engine and the approval system come up here too: every public shell now derives
one-way from the monorepo, drift is watched on a timer, and every deploy passes through a signed Heady
Change Proposal with a φ-stepped canary.

**The apprentice.** And now the chapter's quiet climax: Heady begins to help write Heady. The coder
module wakes up — but as an apprentice under strict supervision, not a free agent. It plans, it works in a
sandbox that can't even see the credentials (those live in the Worker that proxies its traffic), it opens
a pull request, and a human approves. Three independent gates — GitHub, CI, and the workflow itself — each
of which alone can stop a merge, because we learned from the data that humans rubber-stamp ~93% of
approval prompts, so approval can't be the only control. The apprentice starts in **Stage 1**: it may
only write docs, add tests, and make small typed refactors. It cannot touch the eval harness, the gate,
the thresholds, or the merge button — those are the Stage 0 things we made untouchable back in Chapter 0.
A second agent with fresh eyes reviews everything the first writes before any PR opens. The circuit
breaker watches for cost spikes, drift, and anything reaching where it shouldn't, and a single flag kills
the whole thing instantly.

By the end of Chapter 3, Heady has a face people can use, hands that reach across providers, and an
apprentice learning the codebase under a glass box. It is, for the first time, recognizably *the thing*.

---

## Chapter 4 — Earning trust, and earning revenue (Expand carefully)

Everything in this chapter is gated by evidence, not by the calendar. Nothing expands until something
measurable says it's ready.

The apprentice earns **Stage 2** — the right to edit a few of its own non-critical parts, like prompt
templates and minor tool implementations — but *only* when a list of conditions all hold at once: its
first-try pass rate clears a pre-committed bar, the circuit breaker hasn't tripped, it never once tried
to touch a forbidden path, a frozen golden eval still passes, and a human signs an ADR naming exactly
which new surfaces it may touch. The eval harness, the gate, the thresholds, and the merge button stay in
Stage 0 *forever.* That last clause is the whole game — the system can improve itself, but it can never
grade its own homework or move its own goalposts.

Revenue arrives here, narrowly and deliberately. The **IRS Form 990 Parser** ships as the beachhead — a
high-margin, nonprofit-adjacent service that exercises the whole pipeline on a tightly scoped problem.
Behind it, the compliance layer that unlocks the regulated markets: the PHI gate that quarantines health
data before it ever reaches an external model, single-tenant sovereign databases for data residency, the
governance bees watching for RBAC violations. Billing comes online with the reserve-commit pattern so a
multi-step reasoning job never blocks on a database lock, priced in the same Fibonacci tiers that run
through everything else.

The genuinely heavy or exotic bets wait for their evidence here too: a second vector engine only if a
benchmark proves pgvector is the bottleneck; the MIDI-and-creative studio (real-time MIDI flowing out over
the network to live instruments, edge-side image diffusion, the system literally sonifying its own state)
as a creative vertical once the core is solid; post-quantum cryptography phased in alongside today's
signing, never as a risky flag-day swap. The 197-bee, 17-swarm cosmology is fully present as *vocabulary*
the whole time — but it runs as functions and workflow steps and skill rows, not as two hundred daemons
on ninety ports, because that was always the design language, not the deployment.

---

## The thread that runs through every chapter

Underneath the chapters, a few things are always on, from Chapter 1 onward, because they're the operating
system *of* the operating system: traces and SLO-burn alerting (the pager only fires when users are
actually affected); eval gates on every agent PR; a daily spend rollup so a cost spike surfaces in hours,
not at month-end; a monthly drill that actually restores the database from backup, because a backup you've
never restored is a hope, not a plan; the self-improvement loop that turns every error into a permanent
rule and every success into a reusable recipe.

And one human constraint shapes all of it: **you are the bottleneck, and that is on purpose.** Every
approval gate, every "≤1 new platform per chapter," every 20% of capacity reserved for paying down debt —
these aren't limitations to engineer around. They're the thing keeping a one-person company from drowning
in its own ambition. The system is designed so that the founder's attention is the scarce resource it
protects, until the apprentice has earned enough trust to give some of that attention back.

---

## Epilogue — What it looks like when it's done

When the story has run its course, Heady is a modular monolith on a durable spine, fronted by an edge
that serves reads fast and a console that tells the truth about itself. One database is the source of
truth; everything else is a cache or a projection that can be rebuilt from it. Models are reached through
one gated chokepoint, cheap work at the edge and deep work reserved for when it's needed. A coding agent
works alongside you inside a glass box, earning autonomy one proven condition at a time, never able to
touch the rules that judge it. There is a first paying product, a path into regulated markets, and a brand
whose golden-ratio geometry runs from the spacing of the UI to the timing of the heartbeat.

It is, finally, the maximalist vision — but *sequenced*, so that each piece could be finished, verified,
and trusted before the next one started. The dream didn't shrink. It just learned to arrive in order.

---

*Read next: `REBUILD_PLAN_V2.md` for the phase-by-phase plan, `docs/compendium/00-INDEX.md` for the
component-by-component reference, and `docs/adr/` for the decisions. When this story reads true, the ADRs
are ready to move from Proposed to Accepted.*
