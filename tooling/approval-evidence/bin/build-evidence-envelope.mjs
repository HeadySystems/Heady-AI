#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Approval Evidence Envelope CLI v1.0.0                    ║
// ║  Turns one approval view into the canonical envelope to sign and ║
// ║  prints the exact KMS ceremony + decision request that follow.   ║
// ║  Never touches private key material.                             ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
// ╚══════════════════════════════════════════════════════════════════╝

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { EVIDENCE_CEREMONY_MAX_MS } from "@heady/approvals";
import { buildDecisionCeremony, DEFAULT_CEREMONY_TTL_MS } from "../src/envelope.mjs";

const USAGE = [
  "usage: pnpm --filter @heady/approval-evidence envelope \\",
  "         --approval-state <approval-view.json> \\",
  "         --decision approve|reject \\",
  "         --reason <text> \\",
  "         --out <envelope.json> \\",
  "         [--evidence-class founder_decision|external_human_review|external_security_review] \\",
  "         [--resolves-escalation true|false] \\",
  `         [--ttl-ms <1..${EVIDENCE_CEREMONY_MAX_MS}>]`,
  "",
  "  --approval-state  the JSON body of GET /api/approvals/:approvalId",
].join("\n");

const ArgumentsSchema = z.object({
  "approval-state": z.string().min(1),
  decision: z.enum(["approve", "reject"]),
  reason: z.string().min(1),
  out: z.string().min(1),
  "evidence-class": z.enum([
    "founder_decision",
    "external_human_review",
    "external_security_review",
  ]).default("founder_decision"),
  "resolves-escalation": z.enum(["true", "false"]).default("false"),
  "ttl-ms": z.coerce.number().int().positive().max(EVIDENCE_CEREMONY_MAX_MS)
    .default(DEFAULT_CEREMONY_TTL_MS),
}).strict();

function argumentsObject(values) {
  const entries = {};
  for (let index = 0; index < values.length; index += 2) {
    const name = values[index];
    const value = values[index + 1];
    if (!name?.startsWith("--") || value === undefined) {
      throw new TypeError(`arguments must be --name value pairs\n\n${USAGE}`);
    }
    const key = name.slice(2);
    if (Object.hasOwn(entries, key)) {
      throw new TypeError(`--${key} must appear exactly once`);
    }
    entries[key] = value;
  }
  return entries;
}

// `pnpm --filter` runs the script with the package as cwd; INIT_CWD preserves
// the directory the operator actually typed the command in, so relative
// --approval-state/--out paths mean what they look like they mean.
const INVOCATION_CWD = process.env.INIT_CWD ?? process.cwd();
const fromInvocation = (value) => resolve(INVOCATION_CWD, value);

const args = ArgumentsSchema.parse(argumentsObject(process.argv.slice(2)));
const approvalState = JSON.parse(readFileSync(fromInvocation(args["approval-state"]), "utf8"));
const ceremony = buildDecisionCeremony({
  approvalState,
  evidenceClass: args["evidence-class"],
  request: {
    decision: args.decision,
    reason: args.reason,
    resolvesEscalation: args["resolves-escalation"] === "true",
    ttlMs: args["ttl-ms"],
  },
});

const outPath = fromInvocation(args.out);
writeFileSync(outPath, `${JSON.stringify(ceremony.envelope, null, 2)}\n`, { mode: 0o600 });

process.stdout.write(`${JSON.stringify({
  envelopePath: outPath,
  envelopeSha256: ceremony.envelopeSha256,
  evidenceExpiresAt: ceremony.envelope.evidenceExpiresAt,
  nextSteps: [
    "1. Authenticated as the human founder (not the API service account), sign the envelope:",
    "   pnpm --filter @heady/approval-api evidence:sign"
    + " --key-version $HEADY_FOUNDER_EVIDENCE_KEY_VERSION"
    + ` --envelope ${outPath}`,
    "2. POST the returned detached signature with this body to"
    + ` /api/approvals/${ceremony.envelope.approvalId}/${args.decision}:`,
  ],
  decisionRequest: { ...ceremony.decisionRequest, signature: "<detached signature from step 1>" },
}, null, 2)}\n`);
