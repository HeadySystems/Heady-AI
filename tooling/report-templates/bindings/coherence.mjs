#!/usr/bin/env node
// heady-allow:orphans — baseline orphan (rebuild in progress); triage dead-vs-wire in follow-up (audit FILE_MANIFEST)
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ report binding — coherence + drift state                  ║
// ║  Prints JSON for {{coherence.*}} slots. Reads the generated        ║
// ║  artifacts under .data/coherence (fail-soft → nulls when absent).  ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";

const ROOT = resolve(new URL("../../..", import.meta.url).pathname);
const read = (rel) => { try { return JSON.parse(readFileSync(join(ROOT, rel), "utf8")); } catch { return null; } };

const coh = read(".data/coherence/coherence-report.json");
const reg = read(".data/coherence/variable-registry.json");
const classes = {};
for (const v of (reg?.vars || [])) classes[v.class] = (classes[v.class] || 0) + 1;

process.stdout.write(JSON.stringify({
  contradictions: coh?.errors ?? null,
  incomplete: coh?.info ?? null,
  gate: coh ? (coh.errors ? "BLOCKED" : "GREEN") : null,
  variables: reg?.count ?? null,
  classes,
  generatedAt: coh?.generatedAt ?? null,
}));
