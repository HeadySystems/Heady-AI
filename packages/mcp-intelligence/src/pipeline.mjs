// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ MCP Intelligence Pipeline v1.0.0                        ║
// ║  Auth → context → CSL → handler → redaction → Neon receipt.     ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
// ╚══════════════════════════════════════════════════════════════════╝

import { randomUUID } from "node:crypto";
import { cslGate } from "@heady/csl-engine";
import { FIB } from "@heady/phi-math";
import { Bulkhead, CircuitBreaker } from "@heady/resilience";
import { canonicalize, redact, sha256 } from "./canonical.mjs";

const STAGES = Object.freeze(["accepted", "authorized", "contextualized", "routed", "executed", "redacted", "audited", "completed"]);

function identity(authInfo) {
  const tenantId = authInfo?.extra?.tenantId;
  if (!authInfo?.clientId || typeof tenantId !== "string" || tenantId.length === 0) {
    throw new Error("authenticated client and tenant are required");
  }
  return { principalId: authInfo.clientId, tenantId, scopes: new Set(authInfo.scopes ?? []) };
}

function assertScopes(granted, required) {
  if (granted.has("heady:*")) return;
  const missing = required.filter((scope) => !granted.has(scope));
  if (missing.length > 0) throw new Error(`missing MCP scopes: ${missing.join(", ")}`);
}

function errorShape(error) {
  return redact({
    name: error instanceof Error ? error.name : "Error",
    message: error instanceof Error ? error.message : String(error),
  });
}

export function createMcpIntelligencePipeline({ registry, intelligence, audit, publish, log, id = randomUUID } = {}) {
  if (!registry || typeof registry.definition !== "function") throw new TypeError("registry is required");
  if (!intelligence || typeof intelligence.prepare !== "function") throw new TypeError("intelligence.prepare is required");
  if (!audit || typeof audit.append !== "function") throw new TypeError("audit.append is required");

  const bulkhead = new Bulkhead({ limit: FIB[6], queue: FIB[7] });
  const breakers = new Map();

  const publishSafely = async (subject, payload) => {
    if (typeof publish !== "function") return;
    try {
      await publish(subject, payload);
    } catch (error) {
      log?.error?.({ subject, err: errorShape(error) }, "MCP event projection failed");
    }
  };

  return Object.freeze({
    advertised: () => registry.advertised(),
    status: () => registry.status(),

    async invoke(toolName, input, { authInfo, traceId = id(), signal, progress = async () => {} } = {}) {
      const definition = registry.definition(toolName);
      if (!definition) throw new Error(`tool is unavailable or unknown: ${toolName}`);
      const actor = identity(authInfo);
      const callId = id();
      const requestSha256 = sha256({ toolName, input });
      const startedAtMs = Date.now();
      let started = false;

      const emit = async (stage, message, metadata = {}) => {
        const index = STAGES.indexOf(stage);
        await progress({ stage, message, progress: index + 1, total: STAGES.length, metadata: redact(metadata) });
      };

      try {
        await emit("accepted", "Tool call accepted by the intelligence gateway");
        await audit.append({
          schema: "heady.mcp.audit.v1",
          callId,
          tenantId: actor.tenantId,
          principalId: actor.principalId,
          traceId,
          toolName,
          toolVersion: definition.version,
          phase: "STARTED",
          requestSha256,
          startedAt: new Date(startedAtMs).toISOString(),
        });
        started = true;

        assertScopes(actor.scopes, definition.requiredScopes);
        const parsedInput = definition.inputSchema.parse(input);
        await emit("authorized", "Principal, tenant, input schema, and capability policy verified");

        const prepared = await intelligence.prepare({
          tool: toolName,
          input: parsedInput,
          traceId,
          tenantId: actor.tenantId,
          principalId: actor.principalId,
          contextPolicy: definition.contextPolicy,
        });
        await emit("contextualized", "Authoritative context and provenance attached", {
          items: prepared.capsule?.items?.length ?? 0,
          authority: prepared.authority,
          sourceRevision: prepared.sourceRevision ?? null,
        });

        const verdict = cslGate(prepared.confidence, prepared.relevance);
        const allowed = verdict === "EXECUTE" || (verdict === "CAUTIOUS" && definition.risk === "read");
        await emit("routed", `CSL route resolved to ${verdict}`, {
          verdict,
          confidence: prepared.confidence,
          relevance: prepared.relevance,
        });
        if (!allowed) throw new Error(`CSL route ${verdict} does not authorize ${definition.risk} execution`);

        let breaker = breakers.get(toolName);
        if (!breaker) {
          breaker = new CircuitBreaker();
          breakers.set(toolName, breaker);
        }
        const raw = await bulkhead.run(() => breaker.exec(() => definition.handler({
          input: parsedInput,
          actor,
          traceId,
          callId,
          signal,
          context: prepared,
        })));
        await emit("executed", "Deterministic tool handler completed");

        const output = redact(raw);
        const parsed = definition.outputSchema.parse(output);
        await emit("redacted", "Output schema and secret-redaction policy passed");

        const responseSha256 = sha256(canonicalize(parsed));
        const receipt = await audit.append({
          schema: "heady.mcp.audit.v1",
          callId,
          tenantId: actor.tenantId,
          principalId: actor.principalId,
          traceId,
          toolName,
          toolVersion: definition.version,
          phase: "SUCCEEDED",
          requestSha256,
          responseSha256,
          durationMs: Date.now() - startedAtMs,
          redaction: { policy: "security-mesh-recursive", applied: true },
          context: {
            authority: prepared.authority,
            sourceRevision: prepared.sourceRevision ?? null,
            capsuleItems: prepared.capsule?.items?.length ?? 0,
            verdict,
          },
        });
        await emit("audited", "Tamper-evident audit receipt committed", { recordSha256: receipt.recordSha256 });
        await publishSafely("heady.action.mcp.completed", { callId, toolName, tenantId: actor.tenantId, traceId, recordSha256: receipt.recordSha256 });
        await emit("completed", "Tool result released");

        log?.info?.({ callId, toolName, tenantId: actor.tenantId, traceId, recordSha256: receipt.recordSha256 }, "MCP tool call completed");
        return { output: parsed, receipt: { callId, recordSha256: receipt.recordSha256, responseSha256 } };
      } catch (error) {
        const safeError = errorShape(error);
        if (started) {
          try {
            await audit.append({
              schema: "heady.mcp.audit.v1",
              callId,
              tenantId: actor.tenantId,
              principalId: actor.principalId,
              traceId,
              toolName,
              toolVersion: definition.version,
              phase: "FAILED",
              requestSha256,
              durationMs: Date.now() - startedAtMs,
              error: safeError,
            });
          } catch (auditError) {
            log?.error?.({ callId, toolName, traceId, err: errorShape(auditError) }, "MCP failure receipt could not be committed");
          }
        }
        await publishSafely("heady.action.mcp.failed", { callId, toolName, tenantId: actor.tenantId, traceId, error: safeError });
        log?.error?.({ callId, toolName, tenantId: actor.tenantId, traceId, err: safeError }, "MCP tool call failed");
        throw new Error(safeError.message);
      }
    },
  });
}
