// Unit tests for @heady/secrets — pure core, fail-closed loading, CLI parsing. `node --test`.
import { test } from "node:test";
import assert from "node:assert/strict";

import { resolveSecrets, validateSecret } from "../src/core.mjs";
import { loadSecrets, SecretsError } from "../src/index.mjs";
import { SECRETS, SECRET_NAMES, ROTATION_STRATEGIES } from "../src/registry.mjs";
import { planRotation, partitionPlan } from "../src/rotation.mjs";
import { parseEnvLines } from "../src/cli.mjs";

const lookupFrom = (map) => async (name) => map[name];
const DAY = 24 * 60 * 60 * 1000;

test("registry names are unique and mirror the expected catalog", () => {
  assert.equal(new Set(SECRET_NAMES).size, SECRET_NAMES.length);
  for (const want of ["CLOUDFLARE_API_TOKEN", "DATABASE_URL", "VAULT_PASSPHRASE", "INTERNAL_NODE_SECRET"]) {
    assert.ok(SECRET_NAMES.includes(want), `${want} must be registered`);
  }
});

test("validateSecret enforces minLength, prefix, and rejects loopback URLs (AGENTS #4)", () => {
  assert.equal(validateSecret({ minLength: 16, secret: true }, "short"), "must be at least 16 characters");
  assert.equal(validateSecret({ prefix: "postgres", kind: "url" }, "mysql://x"), 'must start with "postgres"');
  const loopback = "postgres://user@" + ["127", "0", "0", "1"].join(".") + ":5432/db";
  assert.match(validateSecret({ kind: "url", prefix: "postgres" }, loopback), /loopback/);
  assert.equal(validateSecret({ kind: "url" }, "https://db.neon.tech/x"), null);
});

test("resolveSecrets reports fail-closed when a required secret is missing", async () => {
  const r = await resolveSecrets(
    [{ name: "DATABASE_URL", required: true, kind: "url", prefix: "postgres" }],
    lookupFrom({}),
  );
  assert.equal(r.ok, false);
  assert.deepEqual(r.missing, ["DATABASE_URL"]);
});

test("resolveSecrets passes when required secrets resolve and validate", async () => {
  const r = await resolveSecrets(
    [{ name: "DATABASE_URL", required: true, kind: "url", prefix: "postgres" }],
    lookupFrom({ DATABASE_URL: "postgres://u@db.neon.tech/x" }),
  );
  assert.equal(r.ok, true);
  assert.equal(r.values.DATABASE_URL, "postgres://u@db.neon.tech/x");
});

test("loadSecrets throws SecretsError (fail-closed) and the error never carries values", async () => {
  await assert.rejects(
    () => loadSecrets({ source: "env", env: {}, require: ["DATABASE_URL"], only: ["DATABASE_URL"] }),
    (err) => {
      assert.ok(err instanceof SecretsError);
      assert.deepEqual(err.result.missing, ["DATABASE_URL"]);
      assert.equal("values" in err.result, false, "error payload must not include values");
      return true;
    },
  );
});

test("loadSecrets returns a frozen value map from env", async () => {
  const env = { DATABASE_URL: "postgres://u@db.neon.tech/x", INTERNAL_NODE_SECRET: "x".repeat(16), VAULT_PASSPHRASE: "y".repeat(16) };
  const secrets = await loadSecrets({ source: "env", env });
  assert.equal(secrets.DATABASE_URL, env.DATABASE_URL);
  assert.throws(() => { secrets.DATABASE_URL = "tampered"; }, TypeError);
});

test("registry rotation metadata is well-formed (valid strategy + FIB-derived maxAgeDays)", () => {
  for (const s of SECRETS) {
    if (!s.rotation) continue;
    assert.ok(ROTATION_STRATEGIES.includes(s.rotation.strategy), `${s.name} strategy`);
    assert.ok(Number.isInteger(s.rotation.maxAgeDays) && s.rotation.maxAgeDays > 0, `${s.name} maxAgeDays`);
  }
  // Only Heady-generated internal secrets are cleanly auto-rotatable.
  const internal = SECRETS.filter((s) => s.rotation?.strategy === "internal").map((s) => s.name);
  assert.deepEqual(internal, ["INTERNAL_NODE_SECRET"]);
});

test("planRotation flags only secrets past maxAgeDays; never-rotated counts as due (age unknown)", () => {
  const reg = [
    { name: "INTERNAL_NODE_SECRET", rotation: { strategy: "internal", maxAgeDays: 21 } },
    { name: "ANTHROPIC_API_KEY", rotation: { strategy: "manual", maxAgeDays: 89 } },
    { name: "CLOUDFLARE_ACCOUNT_ID" }, // no rotation → ignored
  ];
  const now = 1_000 * DAY;
  const ages = { INTERNAL_NODE_SECRET: now - 30 * DAY, ANTHROPIC_API_KEY: now - 10 * DAY };
  const plan = planRotation(reg, ages, now);
  assert.equal(plan.due.length, 1);
  assert.equal(plan.due[0].name, "INTERNAL_NODE_SECRET");
  assert.equal(plan.due[0].autoRotatable, true);

  // A secret with no recorded age is due, flagged unknownAge.
  const plan2 = planRotation(reg, {}, now);
  assert.ok(plan2.due.some((d) => d.name === "ANTHROPIC_API_KEY" && d.ageDays === null));
  assert.ok(plan2.unknownAge.includes("ANTHROPIC_API_KEY"));
});

test("partitionPlan separates auto-rotatable from provider/manual (honest scope)", () => {
  const reg = SECRETS.filter((s) => s.rotation);
  const plan = planRotation(reg, {}, 10_000 * DAY); // everything due
  const { auto, providerAssisted, manual } = partitionPlan(plan);
  assert.deepEqual(auto.map((a) => a.name), ["INTERNAL_NODE_SECRET"]);
  assert.ok(providerAssisted.length >= 1, "Neon/Upstash are provider-assisted");
  assert.ok(manual.some((m) => m.name === "VAULT_PASSPHRASE"), "encryption root is not auto");
});

test("parseEnvLines splits on first '=', skips comments/blanks, and keeps '=' in values", () => {
  const parsed = parseEnvLines("# c\n\nDATABASE_URL=postgres://u:p=q@h/db\nVAULT_PASSPHRASE=abc\n");
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].key, "DATABASE_URL");
  assert.equal(parsed[0].value, "postgres://u:p=q@h/db");
});
