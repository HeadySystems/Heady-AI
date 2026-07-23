// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ task-shapes tests — validator ↔ OpenAPI SoT lock-step      ║
// ║  Proves the strict EnqueueTask validator enforces the contract AND  ║
// ║  cross-checks its field surface against the LIVE OpenAPI schema so  ║
// ║  validator/spec drift fails the build. © 2026 HeadySystems Inc.    ║
// ╚══════════════════════════════════════════════════════════════════╝
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { validateEnqueueTask, ENQUEUE_TASK_FIELDS, TASK_UUID_RE } from "../src/task-shapes.mjs";
import { loadSpec } from "../src/index.mjs";

test("accepts a minimal and a full contract-conformant body", () => {
  assert.equal(validateEnqueueTask({ kind: "embed", input: {} }).ok, true);
  assert.equal(validateEnqueueTask({ kind: "embed", input: { path: "docs" }, deps: [randomUUID()] }).ok, true);
});

test("rejects non-objects, missing required fields, and wrong shapes", () => {
  assert.equal(validateEnqueueTask(null).ok, false);
  assert.equal(validateEnqueueTask([]).ok, false);
  assert.equal(validateEnqueueTask({ input: {} }).ok, false); // kind missing
  assert.equal(validateEnqueueTask({ kind: "" , input: {} }).ok, false); // empty kind
  assert.equal(validateEnqueueTask({ kind: "k", input: [] }).ok, false); // input array
  assert.equal(validateEnqueueTask({ kind: "k", input: null }).ok, false);
  assert.equal(validateEnqueueTask({ kind: "k", input: {}, deps: ["not-a-uuid"] }).ok, false);
  assert.equal(validateEnqueueTask({ kind: "k", input: {}, deps: "x" }).ok, false);
});

test("strict contract: unknown fields are rejected with a named error", () => {
  const r = validateEnqueueTask({ kind: "k", input: {}, extra: 1 });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes("unknown field: extra")));
});

test("LOCK-STEP: validator field surface matches the live OpenAPI EnqueueTask schema", () => {
  const schema = loadSpec().components.schemas.EnqueueTask;
  assert.ok(schema, "components.schemas.EnqueueTask missing from the OpenAPI SoT");
  assert.deepEqual(Object.keys(schema.properties).sort(), [...ENQUEUE_TASK_FIELDS].sort(),
    "validator allowlist drifted from the OpenAPI schema properties");
  for (const req of schema.required) {
    const body = { kind: "k", input: {} };
    delete body[req];
    assert.equal(validateEnqueueTask(body).ok, false, `validator does not require '${req}' but the spec does`);
  }
  assert.equal(schema.properties.deps.items.format, "uuid", "deps items are uuid-formatted in the spec");
  assert.ok(TASK_UUID_RE.test(randomUUID()), "TASK_UUID_RE accepts RFC-4122 UUIDs");
});
