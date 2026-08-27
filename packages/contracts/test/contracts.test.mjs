// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Contracts tests — node:test, zero deps                   ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝

import { test } from "node:test";
import assert from "node:assert/strict";

import { loadSpec, generateMcpTools, spec } from "../src/index.mjs";

test("OpenAPI spec is valid 3.1 with the core operations", () => {
  const s = loadSpec();
  assert.equal(s.openapi, "3.1.0");
  assert.ok(s.paths["/health"].get.operationId === "getHealth");
  assert.ok(s.paths["/tasks"].post.operationId === "enqueueTask");
  assert.ok(s.paths["/990/search"].get.operationId === "search990");
  assert.ok(s.components.schemas.TaskStatus);
  assert.ok(s.components.schemas.Search990Result);
});

test("generateMcpTools produces one tool per operation", () => {
  const tools = generateMcpTools(spec);
  const names = tools.map((t) => t.name).sort();
  assert.deepEqual(names, ["enqueueTask", "getHealth", "getOrg990", "getOrgFilings990", "getTask", "search990"]);
});

test("search990 tool carries the required q query parameter", () => {
  const search = generateMcpTools(spec).find((t) => t.name === "search990");
  assert.equal(search.method, "GET");
  assert.equal(search.path, "/990/search");
  assert.ok(search.inputSchema.properties.q);
  assert.ok(search.inputSchema.required.includes("q"));
});

test("enqueueTask tool inlines the request-body schema (kind/input required)", () => {
  const enqueue = generateMcpTools(spec).find((t) => t.name === "enqueueTask");
  assert.equal(enqueue.method, "POST");
  assert.equal(enqueue.path, "/tasks");
  assert.ok(enqueue.inputSchema.properties.kind);
  assert.ok(enqueue.inputSchema.properties.input);
  assert.ok(enqueue.inputSchema.required.includes("kind"));
  assert.ok(enqueue.inputSchema.required.includes("input"));
});

test("getTask tool carries the path parameter", () => {
  const getTask = generateMcpTools(spec).find((t) => t.name === "getTask");
  assert.ok(getTask.inputSchema.properties.taskId);
  assert.ok(getTask.inputSchema.required.includes("taskId"));
});
