// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Approval API Route Tests v1.0.0                         ║
// ║  Auth separation, trace propagation, route scope, and failures. ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder               ║
// ╚══════════════════════════════════════════════════════════════════╝

import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";
import { UnauthorizedError } from "@heady/shared";
import { createApprovalApi } from "../src/app.mjs";

const APPROVAL_ID = "01K10000000000000000000000";

function fixture({
  databaseHealth = async () => ({ ok: true }),
} = {}) {
  const calls = [];
  const approvalService = {
    async create(value) {
      calls.push(["create", value]);
      return { approvalId: APPROVAL_ID, state: "draft" };
    },
    async requestAutonomous(value) {
      calls.push(["requestAutonomous", value]);
      return { approvalId: APPROVAL_ID, state: "pending" };
    },
    async getAutonomous(value) {
      calls.push(["getAutonomous", value]);
      return { approvalId: APPROVAL_ID, state: "pending" };
    },
    async submit(value) {
      calls.push(["submit", value]);
      return { approvalId: APPROVAL_ID, state: "pending" };
    },
    async get(value) {
      calls.push(["get", value]);
      return { approvalId: APPROVAL_ID, state: "pending" };
    },
    async decide(value) {
      calls.push(["decide", value]);
      return { approvalId: APPROVAL_ID, state: "approved" };
    },
    async attest(value) {
      calls.push(["attest", value]);
      return { approvalId: APPROVAL_ID, state: "pending" };
    },
    async supersede(value) {
      calls.push(["supersede", value]);
      return { approvalId: APPROVAL_ID, state: "superseded" };
    },
    async verify(value) {
      calls.push(["verify", value]);
      return { approvalId: APPROVAL_ID, state: "approved", auditReplay: { valid: true } };
    },
    async receipts(value) {
      calls.push(["receipts", value]);
      return { approvalId: APPROVAL_ID, receipts: [] };
    },
    async deploymentProtection(value) {
      calls.push(["deploymentProtection", value]);
      return { approvalId: APPROVAL_ID, allow: true, reasons: [] };
    },
    async autonomousProtection(value) {
      calls.push(["autonomousProtection", value]);
      return {
        approvalId: APPROVAL_ID,
        allow: true,
        reasons: [],
        grant: { schema: "heady.autonomous.grant.v1" },
      };
    },
  };
  const authenticator = {
    async human(incoming) {
      if (incoming.header("authorization") !== "Bearer human.token") {
        throw new UnauthorizedError("human auth required");
      }
      return {
        authType: "firebase",
        subject: "founder",
        email: "eric@headysystems.com",
        emailVerified: true,
      };
    },
    async workload(incoming) {
      if (incoming.header("authorization") !== "Bearer workload.token") {
        throw new UnauthorizedError("workload auth required");
      }
      return {
        authType: "workload_identity",
        subject: "arbiter",
        email: null,
        emailVerified: false,
      };
    },
  };
  const database = {
    health: databaseHealth,
  };
  const log = {
    error() {},
    warn() {},
  };
  const api = createApprovalApi({ approvalService, authenticator, database, log });
  return { app: api.app, calls };
}

test("human route propagates trace and idempotency without trusting actor body fields", async () => {
  const { app, calls } = fixture();
  const response = await request(app)
    .post("/api/approvals")
    .set("Authorization", "Bearer human.token")
    .set("Idempotency-Key", "create-route-key-0001")
    .set("X-Heady-Trace-Id", "route-trace-0001")
    .send({ actor: "client-claimed-actor", title: "input" });

  assert.equal(response.status, 201);
  assert.equal(response.headers["x-heady-trace-id"], "route-trace-0001");
  assert.equal(response.headers["x-content-type-options"], "nosniff");
  assert.equal(response.headers["cache-control"], "no-store");
  assert.equal(calls[0][0], "create");
  assert.equal(calls[0][1].actor.subject, "founder");
  assert.equal(calls[0][1].idempotencyKey, "create-route-key-0001");
});

test("authenticated reads pass the server-derived actor for principal authorization", async () => {
  const { app, calls } = fixture();
  const response = await request(app)
    .get(`/api/approvals/${APPROVAL_ID}`)
    .set("Authorization", "Bearer human.token");

  assert.equal(response.status, 200);
  assert.equal(calls[0][0], "get");
  assert.equal(calls[0][1].actor.subject, "founder");
});

test("approve and reject routes fail closed when the signed action disagrees with the route", async () => {
  const { app, calls } = fixture();
  const response = await request(app)
    .post(`/api/approvals/${APPROVAL_ID}/approve`)
    .set("Authorization", "Bearer human.token")
    .send({ decision: "reject" });
  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, "VALIDATION");
  assert.equal(calls.length, 0);
});

test("workload routes reject human tokens and accept workload identity", async () => {
  const { app, calls } = fixture();
  const denied = await request(app)
    .post(`/api/approvals/${APPROVAL_ID}/attest`)
    .set("Authorization", "Bearer human.token")
    .send({});
  assert.equal(denied.status, 401);

  const accepted = await request(app)
    .post("/api/deployment-protection")
    .set("Authorization", "Bearer workload.token")
    .send({ approvalId: APPROVAL_ID });
  assert.equal(accepted.status, 200);
  assert.equal(calls.at(-1)[0], "deploymentProtection");
  assert.equal(calls.at(-1)[1].actor.authType, "workload_identity");
});

test("autonomous request and one-time protection routes require workload identity", async () => {
  const { app, calls } = fixture();
  const denied = await request(app)
    .post("/api/autonomous-approvals")
    .set("Authorization", "Bearer human.token")
    .send({});
  assert.equal(denied.status, 401);

  const requested = await request(app)
    .post("/api/autonomous-approvals")
    .set("Authorization", "Bearer workload.token")
    .set("Idempotency-Key", "autonomous-request-0001")
    .send({ capability: "source_authorship" });
  assert.equal(requested.status, 201);
  assert.equal(calls.at(-1)[0], "requestAutonomous");
  assert.equal(calls.at(-1)[1].actor.authType, "workload_identity");

  const read = await request(app)
    .get(`/api/autonomous-approvals/${APPROVAL_ID}`)
    .set("Authorization", "Bearer workload.token");
  assert.equal(read.status, 200);
  assert.equal(calls.at(-1)[0], "getAutonomous");

  const protectedResult = await request(app)
    .post("/api/autonomous-protection")
    .set("Authorization", "Bearer workload.token")
    .set("Idempotency-Key", "autonomous-protect-0001")
    .send({ approvalId: APPROVAL_ID });
  assert.equal(protectedResult.status, 200);
  assert.equal(protectedResult.body.grant.schema, "heady.autonomous.grant.v1");
  assert.equal(calls.at(-1)[0], "autonomousProtection");
});

test("there is no bulk mutation endpoint and malformed trace headers are rejected", async () => {
  const { app } = fixture();
  const bulk = await request(app)
    .post("/api/approvals/bulk")
    .set("Authorization", "Bearer human.token")
    .send([]);
  assert.equal(bulk.status, 404);

  const invalidTrace = await request(app)
    .get(`/api/approvals/${APPROVAL_ID}`)
    .set("Authorization", "Bearer human.token")
    .set("X-Heady-Trace-Id", "x".repeat(234));
  assert.equal(invalidTrace.status, 400);
  assert.equal(invalidTrace.body.error.code, "VALIDATION");
});

test("readiness reports unavailable instead of leaking a database failure", async () => {
  const { app } = fixture({
    databaseHealth: async () => {
      throw new Error("simulated Neon outage");
    },
  });
  const response = await request(app).get("/health/ready");
  assert.equal(response.status, 503);
  assert.deepEqual(response.body.checks, { neon: "down" });
});
