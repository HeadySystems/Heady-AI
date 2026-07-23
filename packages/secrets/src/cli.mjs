#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ heady-secrets CLI v1.0.0                                  ║
// ║  list · doctor (fail-closed resolution) · rotate (secure inject)  ║
// ║  Secrets travel value→store via stdin only; never argv, never     ║
// ║  logged. © 2026 HeadySystems Inc. — Eric Haywood, Founder         ║
// ╚══════════════════════════════════════════════════════════════════╝

import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { SECRETS, SECRET_NAMES, specFor } from "./registry.mjs";
import { resolveSecrets, validateSecret } from "./core.mjs";
import { providerFor } from "./providers.mjs";
import { planRotation, partitionPlan } from "./rotation.mjs";

// IAM roles for the "Heady has auth" handoff: HeadyVault reads versions; HeadyKey adds them.
const ROLE_ACCESSOR = "roles/secretmanager.secretAccessor";
const ROLE_VERSION_ADDER = "roles/secretmanager.secretVersionAdder";

function flagValue(argv, name, fallback) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
}

// Flags that consume the NEXT argv token as their value — their values must
// never be mistaken for a positional (the rotate quarantine-file bug:
// `rotate --project heady-ai` read "heady-ai" as a file → ENOENT).
const VALUE_FLAGS = new Set(["--project", "--source", "--require"]);

/** First true positional: skips flags AND the value token of value-taking flags. */
export function positionalArg(argv, { exclude = [] } = {}) {
  const skip = new Set(exclude);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      if (VALUE_FLAGS.has(a)) i++; // consume the flag's value token too
      continue;
    }
    if (!skip.has(a)) return a;
  }
  return undefined;
}

function projectArgs(project) {
  return project ? ["--project", project] : [];
}

/** Parse KEY=VALUE lines. Never echoes values. Returns [{ key, value, lineNo }]. */
function parseEnvLines(text) {
  const out = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) throw new Error(`line ${i + 1}: expected KEY=VALUE`);
    out.push({ key: line.slice(0, eq).trim(), value: line.slice(eq + 1), lineNo: i + 1 });
  }
  return out;
}

function cmdList(write) {
  write("\nHEADY™ secret registry:\n\n");
  for (const s of SECRETS) {
    write(`  ${s.required ? "●" : "○"} ${s.name}${s.secret ? " [SECRET]" : ""}\n`);
    write(`      ${s.description}\n`);
  }
  write("\n  ● required   ○ optional\n\n");
}

async function cmdDoctor(argv, write) {
  const source = flagValue(argv, "--source", "auto");
  const project = flagValue(argv, "--project", undefined);
  const require = (flagValue(argv, "--require", "") || "").split(",").filter(Boolean);

  let registry = SECRETS;
  if (require.length) {
    const req = new Set(require);
    registry = registry.map((s) => (req.has(s.name) ? { ...s, required: true } : s));
  }
  const result = await resolveSecrets(registry, providerFor(source, { project }));

  write(`\nHEADY™ secret doctor (source: ${source}) — values are never displayed\n\n`);
  for (const s of registry) {
    const invalid = result.invalid.find((i) => i.name === s.name);
    const status = result.present.includes(s.name)
      ? "✓ present"
      : invalid
        ? `✗ invalid (${invalid.error})`
        : s.required
          ? "✗ MISSING (required)"
          : "· absent (optional)";
    write(`  ${status.padEnd(34)} ${s.name}\n`);
  }
  write(
    `\n  summary: ${result.present.length} present, ${result.missing.length} required-missing, ` +
      `${result.invalid.length} invalid → ${result.ok ? "OK" : "FAIL (fail-closed)"}\n\n`,
  );
  process.exitCode = result.ok ? 0 : 1;
}

function secretExists(name, project) {
  const r = spawnSync("gcloud", ["secrets", "describe", name, ...projectArgs(project), "--quiet"], { encoding: "utf8" });
  return r.status === 0;
}

function addVersion(name, value, project) {
  const r = spawnSync(
    "gcloud",
    ["secrets", "versions", "add", name, "--data-file=-", ...projectArgs(project), "--quiet"],
    { input: value, encoding: "utf8" }, // value via stdin — never argv, never history
  );
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || "gcloud add failed").trim());
  const m = (r.stderr || r.stdout || "").match(/version \[(\d+)\]/i);
  return m ? m[1] : "?";
}

async function cmdRotate(argv, write) {
  const project = flagValue(argv, "--project", undefined);
  const dryRun = argv.includes("--dry-run");
  const create = argv.includes("--create");
  const allowUnknown = argv.includes("--allow-unknown");
  const fileArg = positionalArg(argv, { exclude: ["rotate"] });

  // Read the new values from a quarantine file or stdin (fd 0). Values stay in memory only.
  const raw = fileArg ? readFileSync(fileArg, "utf8") : readFileSync(0, "utf8");
  const entries = parseEnvLines(raw);
  if (entries.length === 0) throw new Error("no KEY=VALUE lines provided on stdin or file");

  write(`\nHEADY™ secret rotation${dryRun ? " (DRY RUN — no writes)" : ""}${project ? ` · project ${project}` : ""}\n\n`);
  let rotated = 0;
  let skipped = 0;
  for (const { key, value, lineNo } of entries) {
    if (!SECRET_NAMES.includes(key)) {
      if (!allowUnknown) {
        write(`  ⚠ skip ${key} — not in the registry (use --allow-unknown to override)\n`);
        skipped++;
        continue;
      }
    }
    const spec = specFor(key) ?? { name: key };
    const err = validateSecret(spec, value);
    if (err) {
      write(`  ✗ ${key} (line ${lineNo}) — invalid: ${err}; NOT rotated\n`);
      skipped++;
      continue;
    }
    if (dryRun) {
      write(`  • would rotate ${key} (${value.length} chars)\n`);
      rotated++;
      continue;
    }
    if (!secretExists(key, project)) {
      if (!create) {
        write(`  ✗ ${key} — secret does not exist (pass --create to create it); skipped\n`);
        skipped++;
        continue;
      }
      const c = spawnSync(
        "gcloud",
        ["secrets", "create", key, "--replication-policy", "automatic", ...projectArgs(project), "--quiet"],
        { encoding: "utf8" },
      );
      if (c.status !== 0) {
        write(`  ✗ ${key} — create failed: ${(c.stderr || "").trim()}\n`);
        skipped++;
        continue;
      }
    }
    const version = addVersion(key, value, project);
    write(`  ✓ rotated ${key} → version ${version}\n`);
    rotated++;
  }
  write(`\n  ${dryRun ? "would rotate" : "rotated"} ${rotated}, skipped ${skipped}. `);
  write(`Now shred the source file: \`shred -u <file>\` (or it was piped — already gone).\n\n`);
  process.exitCode = skipped > 0 && rotated === 0 ? 1 : 0;
}

/** Read the current version's createTime (epoch-ms) for a secret, or null if absent/forbidden. */
function versionAgeMs(name, project) {
  const r = spawnSync(
    "gcloud",
    ["secrets", "versions", "describe", "latest", "--secret", name, ...projectArgs(project),
      "--format", "value(createTime)", "--quiet"],
    { encoding: "utf8" },
  );
  if (r.status !== 0) return null;
  const t = Date.parse((r.stdout || "").trim());
  return Number.isFinite(t) ? t : null;
}

async function cmdRotationStatus(argv, write) {
  const project = flagValue(argv, "--project", undefined);
  const rotatable = SECRETS.filter((s) => s.rotation);
  const ages = {};
  for (const s of rotatable) {
    const t = versionAgeMs(s.name, project);
    if (t != null) ages[s.name] = t;
  }
  const plan = planRotation(rotatable, ages, Date.now());
  const { auto, providerAssisted, manual } = partitionPlan(plan);

  write(`\nHEADY™ rotation status${project ? ` · project ${project}` : ""} — values never displayed\n\n`);
  for (const s of rotatable) {
    const d = plan.due.find((x) => x.name === s.name);
    const status = d
      ? `DUE (${d.ageDays == null ? "age unknown" : `${d.ageDays}d ≥ ${d.maxAgeDays}d`})`
      : "ok";
    write(`  ${status.padEnd(26)} ${s.name}  [${s.rotation.strategy}]\n`);
  }
  write(
    `\n  ${plan.due.length} due — ${auto.length} auto-rotatable (internal), ` +
      `${providerAssisted.length} provider-API, ${manual.length} manual/root.\n`,
  );
  if (auto.length) {
    write(`  ↳ auto-rotation of the internal secret(s) is gated on founder patent-clearance (HS-2026-051+).\n`);
  }
  if (providerAssisted.length || manual.length) {
    write(`  ↳ rotate the rest with: heady-secrets rotate <file> (provider/manual paths).\n`);
  }
  process.exitCode = plan.ok ? 0 : 1;
}

function cmdGrant(argv, write) {
  const project = flagValue(argv, "--project", undefined);
  const dryRun = argv.includes("--dry-run");
  const sa = argv.find((a) => a.includes("@"));
  if (!sa) throw new Error("grant requires the dedicated service-account email, e.g. heady-vault@heady-ai.iam.gserviceaccount.com");
  const member = `serviceAccount:${sa}`;

  write(`\nHEADY™ IAM grant${dryRun ? " (DRY RUN)" : ""} — least-privilege, per-secret\n`);
  write(`  principal: ${member}\n`);
  write(`  HeadyVault → ${ROLE_ACCESSOR} on every secret; HeadyKey → ${ROLE_VERSION_ADDER} on internal secrets only.\n\n`);

  const bind = (name, role) => {
    if (dryRun) {
      write(`  • would bind ${role.split("/").pop()} on ${name}\n`);
      return true;
    }
    const r = spawnSync(
      "gcloud",
      ["secrets", "add-iam-policy-binding", name, "--member", member, "--role", role, ...projectArgs(project), "--quiet"],
      { encoding: "utf8" },
    );
    if (r.status !== 0) {
      write(`  ✗ ${name} ${role.split("/").pop()} — ${(r.stderr || "").trim()}\n`);
      return false;
    }
    write(`  ✓ ${name} ← ${role.split("/").pop()}\n`);
    return true;
  };

  let ok = true;
  for (const s of SECRETS) {
    ok = bind(s.name, ROLE_ACCESSOR) && ok;
    if (s.rotation?.strategy === "internal") ok = bind(s.name, ROLE_VERSION_ADDER) && ok;
  }
  write(`\n  ${dryRun ? "preview complete" : ok ? "all bindings applied" : "some bindings failed — see above"}.\n\n`);
  process.exitCode = ok ? 0 : 1;
}

async function main(argv) {
  const write = (s) => process.stdout.write(s);
  const cmd = argv[0] ?? "list";
  try {
    if (cmd === "list") return cmdList(write);
    if (cmd === "doctor") return await cmdDoctor(argv, write);
    if (cmd === "rotate") return await cmdRotate(argv.slice(1), write);
    if (cmd === "rotation-status") return await cmdRotationStatus(argv.slice(1), write);
    if (cmd === "grant") return cmdGrant(argv.slice(1), write);
    process.stderr.write(`heady-secrets: unknown command "${cmd}". Use: list | doctor | rotate | rotation-status | grant.\n`);
    process.exitCode = 2;
  } catch (err) {
    process.stderr.write(`heady-secrets: ${err.message}\n`);
    process.exitCode = 2;
  }
}

function isProgramEntry() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isProgramEntry()) {
  main(process.argv.slice(2));
}

export { parseEnvLines };
