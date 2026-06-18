# Heady™ Report Templating & Distillation

> Analyze reports for focus/content → distill a **deterministic recipe** → render reports/narratives by
> **injecting live + canonical data** into HeadyBee templates. The drift-proof, single-source answer to
> "reports should be projections of system state, not hand-written prose." © 2026 HeadySystems Inc.

## The loop (HCFP Stage-20 DISTILL applied to documents)

```
docs corpus ──distill──► recipe (focus + common shape + derivable data-points + deterministic prompt)
                            │
                            ▼
                  HeadyBee report template (.hbs)  ──render──►  generated report (live + canonical)
                   {{canon facts.*}}  {{binding.key}}  <!--heady:inject KEY-->
                            ▲                                         │
                  heady-derive canon (facts.yaml)            CI: render.mjs check (fail-closed)
                  bindings/*.mjs (coherence, ledger, …)
```

## Components (`tooling/report-templates/`)

- **`src/distill.mjs`** — `distill.mjs <docDir>`: structural analysis of a report corpus → recipe JSON +
  a **deterministic reproduction prompt**. Extracts per-doc heading tree, depth-2 **shape**, **focus**
  terms, and **derivable data-points** (each number mapped to a likely canon key, e.g. "51"→
  `facts.company.patents_provisional`, "21-stage"→`facts.hcfullpipeline.stage_count`). Deterministic, no
  LLM; GEPA/MIPROv2 prompt-optimization (the `heady-distiller` skill) is an optional layer on top.
  *Verified: 11 master-plan docs → 304 derivable data-points.*
- **`src/render.mjs`** — `render [name]` / `check [name]`: fills a template's `{{canon …}}`,
  `{{binding.key}}`, and `<!--heady:inject KEY-->` slots and writes to the template's declared `output:`.
  `check` is the CI gate (exit 1 if any report is stale vs template+data).
- **`templates/*.hbs`** — frontmatter (`output:`, `bindings:`) + body with the three slot types. Shipped:
  `master-plan-status.hbs` → `docs/master-plan/STATUS.md`; `system-snapshot.hbs` → `docs/SYSTEM_SNAPSHOT.md`.
- **`bindings/*.mjs`** — each prints JSON for one `{{ns.*}}` namespace; fail-soft (nulls when a source is
  absent). Shipped: `coherence` (`.data/coherence`), `ledger` (codeflow + decomposition; task counts need
  a live DB).

## Three injection mechanisms (when to use which)

| Slot | Source | Use for |
|------|--------|---------|
| `<!--heady:inject KEY-->…<!--/…-->` | heady-derive canon (facts.yaml) | **locked** load-bearing values (patents, stage count) — drift-proof, CI-enforced |
| `{{canon facts.x.y}}` | heady-derive canon | canonical facts that don't need an in-place audit region |
| `{{ns.dotted.key}}` | a `bindings/<ns>.mjs` script | **live** runtime data (coherence gate, counts, task/Linear state) |

## How it stays true (drift-proof by construction)

Every load-bearing number comes from the golden record or a live binding — never typed inline. A
hand-edit to a generated report is overwritten on next `render`, and `render.mjs check` fails CI if a
report drifts from its template+data. This extends the same guarantee the coherence scalar-guard +
heady-derive give to skills/docs, now to **reports and narratives**.

## Relationship to the bees & narrative

`render.mjs` is the engine a **documentation-bee / report-bee** invokes; `@heady/narrative`
(`createNarrator`/`narrateStep`) streams the *live* build-narrative variant into HeadyLens. A template is
the bee's "recipe"; the distiller produces new recipes from existing report corpora.

## Run

```
node tooling/report-templates/src/distill.mjs docs/master-plan      # corpus → recipe + prompt
node tooling/report-templates/src/render.mjs render                 # fill all templates → reports
node tooling/report-templates/src/render.mjs check                  # CI freshness gate
node --test tooling/report-templates/test/report-templates.test.mjs # 5 tests
```

## Extending

Add a report: drop a `templates/<name>.hbs` (declare `output:` + `bindings:`) + any new
`bindings/<ns>.mjs`. To bind live task/Linear data, implement the `ledger` binding's DB path
(`@heady/task-ledger` counts) and a `linear` binding (Linear GraphQL) — see
`docs/research/LINEAR_HEADY_TASK_INTEGRATION.md`.
