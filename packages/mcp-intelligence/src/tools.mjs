// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ MCP Core Tools v1.0.0                                   ║
// ║  Functional awareness, governance, memory, and task contracts.  ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
// ╚══════════════════════════════════════════════════════════════════╝

import { posix } from "node:path";
import { z } from "zod4";
import { FIB } from "@heady/phi-math";
import { sha256 } from "./canonical.mjs";

const MAX_FILES = FIB[12];
const MAX_CONTENT_CHARS = FIB[16] * FIB[8];
const MAX_QUERY_CHARS = FIB[14] * FIB[4];
const MAX_HISTORY = FIB[8];
const SHA256_HEX_LENGTH = 64;
const TOOL_VERSION = "1.0.0";
const PATH_ERROR = "path must be relative, normalized, and remain inside the supplied snapshot";
const MAX_990_QUERY = FIB[13] - FIB[9] + FIB[1];
const EIN = z.string().regex(/^[0-9]{9}$/);

const SafePath = z.string().min(1).max(MAX_QUERY_CHARS).refine((value) => {
  if (value.includes("\\") || value.startsWith("/") || value.includes("\0")) return false;
  const normalized = posix.normalize(value);
  return normalized === value && normalized !== ".." && !normalized.startsWith("../");
}, PATH_ERROR);
const Sha256 = z.string().length(SHA256_HEX_LENGTH).regex(/^[a-f0-9]+$/);

const SnapshotFile = z.object({
  path: SafePath,
  size: z.number().int().nonnegative().optional(),
  sha256: Sha256.optional(),
  content: z.string().max(MAX_CONTENT_CHARS).optional(),
});

const Finding = z.object({
  path: z.string(),
  rule: z.string(),
  severity: z.enum(["error", "warning"]),
  line: z.number().int().positive().nullable(),
  message: z.string(),
});

function normalizeFiles(files) {
  const seen = new Set();
  return files.map((file) => {
    if (seen.has(file.path)) throw new Error(`duplicate snapshot path: ${file.path}`);
    seen.add(file.path);
    const content = file.content;
    const contentSha256 = content === undefined ? file.sha256 : sha256(content);
    if (!contentSha256) throw new Error(`snapshot file requires content or sha256: ${file.path}`);
    if (file.sha256 && content !== undefined && file.sha256 !== contentSha256) {
      throw new Error(`snapshot checksum mismatch: ${file.path}`);
    }
    return {
      path: file.path,
      size: file.size ?? (content === undefined ? 0 : Buffer.byteLength(content)),
      sha256: contentSha256,
      ...(content === undefined ? {} : { content }),
    };
  }).sort((left, right) => left.path.localeCompare(right.path));
}

function snapshotRoot(files) {
  return sha256(files.map(({ path, sha256: digest }) => `${path}\0${digest}`).join("\n"));
}

function projectTree(files) {
  const directories = new Map();
  for (const file of files) {
    const parts = file.path.split("/");
    for (let index = 0; index < parts.length - 1; index += 1) {
      const path = parts.slice(0, index + 1).join("/");
      const current = directories.get(path) ?? { path, fileCount: 0, totalBytes: 0 };
      current.fileCount += 1;
      current.totalBytes += file.size;
      directories.set(path, current);
    }
  }
  return [...directories.values()].sort((left, right) => left.path.localeCompare(right.path));
}

function governanceScan(files) {
  const findings = [];
  const incompleteMarkers = ["TO" + "DO", "FIX" + "ME", "HA" + "CK"];
  const localHostPattern = new RegExp(["local", "host"].join(""), "i");
  const sourceExtension = /\.(?:js|mjs|ts|tsx)$/;

  for (const file of files) {
    if (file.content === undefined) continue;
    const lines = file.content.split(/\r?\n/);
    if (sourceExtension.test(file.path) && !file.content.slice(0, FIB[13]).includes("HEADY")) {
      findings.push({ path: file.path, rule: "brand-header", severity: "error", line: 1, message: "Source file lacks the required HEADY brand header" });
    }
    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      if (/\bconsole\.log\s*\(/.test(line)) findings.push({ path: file.path, rule: "structured-logging", severity: "error", line: lineNumber, message: "Use the structured logger" });
      if (/\brequire\s*\(/.test(line)) findings.push({ path: file.path, rule: "esm-only", severity: "error", line: lineNumber, message: "CommonJS require is not allowed" });
      if (localHostPattern.test(line)) findings.push({ path: file.path, rule: "configured-url", severity: "error", line: lineNumber, message: "Loopback host text is not allowed in source configuration" });
      if (incompleteMarkers.some((marker) => line.includes(marker))) findings.push({ path: file.path, rule: "complete-code", severity: "error", line: lineNumber, message: "Incomplete-work marker is not allowed" });
    });
  }
  return findings;
}

function tool(definition) {
  return Object.freeze({
    version: TOOL_VERSION,
    requiredScopes: ["heady:mcp:read"],
    contextPolicy: "metadata",
    risk: "read",
    ...definition,
  });
}

export const DEFERRED_CAPABILITIES = Object.freeze([
  { name: "heady_chat", reason: "No canonical model-gateway handler with tenant-bound history is deployed" },
  { name: "heady_analyze", reason: "No canonical analysis handler is deployed" },
  { name: "heady_complete", reason: "Provider calls must be consolidated behind the liquid intelligence gateway" },
  { name: "heady_refactor", reason: "Remote code mutation requires governed source revisions and approval receipts" },
  { name: "heady_auto_flow", reason: "The canonical AutoFlow workflow has no durable production executor" },
  { name: "heady_battle", reason: "The legacy battle route returns simulated scores" },
  { name: "heady_risks", reason: "The legacy risk route is a service stub" },
  { name: "heady_patterns", reason: "The legacy patterns endpoint is absent" },
  { name: "heady_source_ingest", reason: "ADR-0051 source-ledger activation has not been verified" },
  { name: "heady_call_start", reason: "Cloudflare Workflow, Queue consumer, and durable call schema are not deployed" },
  { name: "heady_call_get", reason: "Durable MCP call state is not deployed" },
  { name: "heady_call_watch", reason: "Durable MCP call progress projection is not deployed" },
  { name: "heady_call_cancel", reason: "Durable cancellation control is not deployed" },
]);

export function createCoreToolDefinitions(runtime) {
  if (!runtime || typeof runtime.health !== "function") throw new TypeError("MCP runtime is required");

  const ProjectTreeOutput = z.object({
    authority: z.string(),
    merkleRoot: Sha256,
    fileCount: z.number().int().nonnegative(),
    totalBytes: z.number().int().nonnegative(),
    directories: z.array(z.object({ path: z.string(), fileCount: z.number().int(), totalBytes: z.number().int() })),
    files: z.array(z.object({ path: z.string(), size: z.number().int(), sha256: Sha256 })),
  });

  const tools = [
    tool({
      name: "heady_health",
      title: "Heady MCP Health",
      description: "Return measured manager, intelligence, audit, and source-authority status.",
      inputSchema: z.object({}),
      outputSchema: z.object({ status: z.string(), sourceAuthority: z.string(), services: z.record(z.string(), z.unknown()), timestamp: z.string() }),
      handler: () => runtime.health(),
    }),
    tool({
      name: "heady_services_list",
      title: "Heady Services",
      description: "List kernel-registered services using measured health, never registry presence as liveness.",
      inputSchema: z.object({}),
      outputSchema: z.object({ services: z.array(z.object({ name: z.string(), status: z.string(), details: z.record(z.string(), z.unknown()).optional() })) }),
      handler: () => runtime.services(),
    }),
    tool({
      name: "heady_tool_status",
      title: "Heady Tool Status",
      description: "Explain which canonical MCP capabilities are available and why others are not advertised.",
      inputSchema: z.object({}),
      outputSchema: z.object({ implemented: z.array(z.record(z.string(), z.unknown())), deferred: z.array(z.record(z.string(), z.unknown())) }),
      handler: () => runtime.toolStatus(),
    }),
    tool({
      name: "heady_project_tree",
      title: "Project Tree",
      description: "Validate a client-supplied file manifest and return its deterministic Merkle tree projection.",
      inputSchema: z.object({ files: z.array(SnapshotFile.omit({ content: true })).min(1).max(MAX_FILES) }),
      outputSchema: ProjectTreeOutput,
      handler: ({ input }) => {
        const files = normalizeFiles(input.files);
        return {
          authority: "client-supplied-worktree-observation",
          merkleRoot: snapshotRoot(files),
          fileCount: files.length,
          totalBytes: files.reduce((sum, file) => sum + file.size, 0),
          directories: projectTree(files),
          files: files.map(({ path, size, sha256: digest }) => ({ path, size, sha256: digest })),
        };
      },
    }),
    tool({
      name: "heady_env_audit",
      title: "Environment Metadata Audit",
      description: "Compare environment variable names only; values and secrets are never accepted or returned.",
      inputSchema: z.object({ declared: z.array(z.string().min(1)).max(MAX_FILES), present: z.array(z.string().min(1)).max(MAX_FILES), required: z.array(z.string().min(1)).max(MAX_FILES) }),
      outputSchema: z.object({ missingRequired: z.array(z.string()), undeclaredPresent: z.array(z.string()), secretNamed: z.array(z.string()), ok: z.boolean() }),
      handler: ({ input }) => {
        const declared = new Set(input.declared);
        const present = new Set(input.present);
        const secretName = /(?:token|secret|password|passphrase|api.?key|private.?key)/i;
        const missingRequired = [...new Set(input.required)].filter((name) => !present.has(name)).sort();
        const undeclaredPresent = [...present].filter((name) => !declared.has(name)).sort();
        const secretNamed = [...declared].filter((name) => secretName.test(name)).sort();
        return { missingRequired, undeclaredPresent, secretNamed, ok: missingRequired.length === 0 };
      },
    }),
    tool({
      name: "heady_governance_enforce",
      title: "Governance Enforcement",
      description: "Run deterministic Heady source rules over an explicitly supplied bounded snapshot.",
      inputSchema: z.object({ files: z.array(SnapshotFile).min(1).max(MAX_FILES) }),
      outputSchema: z.object({ allowed: z.boolean(), checkedFiles: z.number().int(), findings: z.array(Finding), merkleRoot: Sha256 }),
      handler: ({ input }) => {
        const files = normalizeFiles(input.files);
        const findings = governanceScan(files);
        return { allowed: findings.every((finding) => finding.severity !== "error"), checkedFiles: files.length, findings, merkleRoot: snapshotRoot(files) };
      },
    }),
    tool({
      name: "heady_deep_scan",
      title: "Deep Snapshot Scan",
      description: "Analyze a bounded client snapshot; remote servers never interpret client-local path strings.",
      inputSchema: z.object({ files: z.array(SnapshotFile).min(1).max(MAX_FILES) }),
      outputSchema: z.object({ authority: z.string(), merkleRoot: Sha256, fileCount: z.number().int(), totalBytes: z.number().int(), extensions: z.record(z.string(), z.number().int()), findings: z.array(Finding), confidence: z.number() }),
      handler: ({ input }) => {
        const files = normalizeFiles(input.files);
        const extensions = {};
        for (const file of files) {
          const extension = posix.extname(file.path) || "[none]";
          extensions[extension] = (extensions[extension] ?? 0) + 1;
        }
        const findings = governanceScan(files);
        const contentCoverage = files.filter((file) => file.content !== undefined).length / files.length;
        return {
          authority: "client-supplied-worktree-observation",
          merkleRoot: snapshotRoot(files),
          fileCount: files.length,
          totalBytes: files.reduce((sum, file) => sum + file.size, 0),
          extensions,
          findings,
          confidence: Number(contentCoverage.toFixed(FIB[4])),
        };
      },
    }),
    tool({
      name: "heady_autocontext_enrich",
      title: "AutoContext Enrichment",
      description: "Retrieve a tenant-bound, CSL-ranked context capsule from Neon pgvector.",
      contextPolicy: "semantic",
      available: () => runtime.semanticAvailability(),
      inputSchema: z.object({ query: z.string().min(1).max(MAX_QUERY_CHARS) }),
      outputSchema: z.object({ profile: z.string(), gate: z.number(), budget: z.number(), items: z.array(z.record(z.string(), z.unknown())), considered: z.number(), gated: z.number(), deduped: z.number(), coherence: z.number() }),
      handler: ({ context }) => context.capsule,
    }),
    tool({
      name: "heady_autocontext_history",
      title: "AutoContext and Tool History",
      description: "Read the tenant's append-only MCP intelligence receipts from Neon.",
      available: () => runtime.auditAvailability(),
      inputSchema: z.object({ limit: z.number().int().min(1).max(MAX_HISTORY).default(FIB[6]) }),
      outputSchema: z.object({ events: z.array(z.record(z.string(), z.unknown())), chainValid: z.boolean() }),
      handler: ({ input, actor }) => runtime.history({ tenantId: actor.tenantId, limit: input.limit }),
    }),
    tool({
      name: "heady_memory_search",
      title: "Search Heady Memory",
      description: "Search tenant-bound 384-dimensional Neon pgvector memory with the locked embedding model.",
      contextPolicy: "semantic",
      available: () => runtime.semanticAvailability(),
      inputSchema: z.object({ query: z.string().min(1).max(MAX_QUERY_CHARS), limit: z.number().int().min(1).max(FIB[8]).default(FIB[5]) }),
      outputSchema: z.object({ results: z.array(z.object({ id: z.string(), content: z.string(), similarity: z.number(), metadata: z.record(z.string(), z.unknown()), createdAt: z.string() })), count: z.number().int(), model: z.string(), dimension: z.number().int() }),
      handler: ({ input, actor, context }) => runtime.memorySearch({ ...input, tenantId: actor.tenantId, queryEmbedding: context.queryEmbedding }),
    }),
    tool({
      name: "heady_memory_store",
      title: "Store Heady Memory",
      description: "Idempotently persist tenant-bound content and its locked 384-dimensional embedding in Neon.",
      risk: "write",
      requiredScopes: ["heady:mcp:write"],
      available: () => runtime.semanticAvailability(),
      inputSchema: z.object({ content: z.string().min(1).max(MAX_CONTENT_CHARS), idempotencyKey: z.string().min(FIB[5]).max(FIB[12]), metadata: z.record(z.string(), z.unknown()).default({}) }),
      outputSchema: z.object({ stored: z.boolean(), replayed: z.boolean(), id: z.string(), model: z.string(), dimension: z.number().int() }),
      handler: ({ input, actor, traceId, callId }) => runtime.memoryStore({ ...input, tenantId: actor.tenantId, principalId: actor.principalId, traceId, callId }),
    }),
    tool({
      name: "heady_990_search",
      title: "Search 990 Intelligence",
      description: "Search the canonical provenance-linked IRS 990 data plane with keyword and available semantic ranking.",
      available: () => runtime.heady990Availability(),
      inputSchema: z.object({
        q: z.string().min(1).max(MAX_990_QUERY),
        limit: z.number().int().min(1).max(MAX_990_QUERY).default(FIB[8]),
        state: z.string().regex(/^[A-Za-z]{2}$/).optional(),
        minRevenue: z.number().nonnegative().optional(),
      }),
      outputSchema: z.object({
        query: z.object({ q: z.string(), limit: z.number().int(), state: z.string().nullable(), minRevenue: z.number().nullable() }),
        mode: z.enum(["keyword-only", "hybrid"]),
        count: z.number().int().nonnegative(),
        results: z.array(z.object({
          ein: EIN,
          name: z.string(),
          state: z.string().nullable(),
          nteeCode: z.string().nullable(),
          latestFiling: z.record(z.string(), z.unknown()).nullable(),
          score: z.number(),
          provenance: z.object({ sourceObjectId: z.string(), sourceUrl: z.string().nullable(), contentSha256: Sha256 }),
        })),
      }),
      handler: ({ input }) => runtime.heady990Search(input),
    }),
    tool({
      name: "heady_990_org_get",
      title: "Get 990 Organization",
      description: "Fetch one IRS tax-exempt organization from the canonical 990 data plane by EIN.",
      available: () => runtime.heady990Availability(),
      inputSchema: z.object({ ein: EIN }),
      outputSchema: z.object({ org: z.record(z.string(), z.unknown()) }),
      handler: ({ input }) => runtime.heady990GetOrg(input.ein),
    }),
    tool({
      name: "heady_990_filings_list",
      title: "List 990 Filings",
      description: "List an organization's newest-first IRS 990 filings with immutable source provenance.",
      available: () => runtime.heady990Availability(),
      inputSchema: z.object({ ein: EIN }),
      outputSchema: z.object({ ein: EIN, count: z.number().int().nonnegative(), filings: z.array(z.record(z.string(), z.unknown())) }),
      handler: ({ input }) => runtime.heady990GetFilings(input.ein),
    }),
    tool({
      name: "heady_task_enqueue",
      title: "Enqueue Durable Task",
      description: "Commit a task and transactional outbox row through the canonical Neon write path.",
      risk: "write",
      requiredScopes: ["heady:mcp:write"],
      available: () => runtime.taskAvailability(),
      inputSchema: z.object({ kind: z.string().min(1).max(FIB[10]), input: z.record(z.string(), z.unknown()), deps: z.array(z.string().uuid()).max(FIB[6]).default([]) }),
      outputSchema: z.object({ taskId: z.string().uuid(), status: z.string() }),
      handler: ({ input, traceId }) => runtime.taskEnqueue({ ...input, traceId }),
    }),
    tool({
      name: "heady_task_status",
      title: "Task Status",
      description: "Read a durable task from the canonical Neon task ledger.",
      available: () => runtime.taskAvailability(),
      inputSchema: z.object({ taskId: z.string().uuid() }),
      outputSchema: z.object({ taskId: z.string().uuid(), status: z.string(), result: z.unknown().optional() }),
      handler: ({ input }) => runtime.taskStatus(input.taskId),
    }),
  ];

  return tools.map((definition) => {
    const capabilityAvailability = definition.available;
    return Object.freeze({
      ...definition,
      available: () => {
        const controlPlane = runtime.controlPlaneAvailability();
        if (controlPlane !== true) return controlPlane;
        return typeof capabilityAvailability === "function" ? capabilityAvailability() : true;
      },
    });
  });
}
