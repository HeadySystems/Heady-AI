// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Genesis Neon Target Guard v1.0.0                       ║
// ║  Read-only control-plane binding for the one production branch.║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝

import { z } from "zod";
import { GENESIS_TARGET } from "./genesis-contract.mjs";

const BranchResponseSchema = z.object({
  branch: z.object({
    id: z.string(),
    project_id: z.string(),
    name: z.string(),
  }).passthrough(),
}).passthrough();
const EndpointResponseSchema = z.object({
  endpoints: z.array(z.object({
    id: z.string(),
    project_id: z.string(),
    branch_id: z.string(),
    host: z.string(),
    type: z.enum(["read_write", "read_only"]),
    disabled: z.boolean().optional(),
  }).passthrough()),
}).passthrough();

export function parseNeonConnectionUrl(connectionString, { pooled }) {
  const parsed = new URL(connectionString);
  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol)
    || !parsed.hostname.endsWith(".neon.tech")
    || !["require", "verify-full"].includes(parsed.searchParams.get("sslmode"))
  ) {
    throw new TypeError("genesis database URLs must be TLS-enforced Neon PostgreSQL URLs");
  }
  const isPooled = parsed.hostname.includes("-pooler.");
  if (isPooled !== pooled) {
    throw new TypeError(pooled
      ? "runtime verification requires a pooled Neon URL"
      : "genesis execution requires a direct Neon URL");
  }
  if (parsed.pathname.slice(1) !== GENESIS_TARGET.databaseName) {
    throw new TypeError("database URL does not target the pinned production database");
  }
  return Object.freeze({
    hostname: parsed.hostname,
    endpointHostname: parsed.hostname.replace("-pooler.", "."),
    databaseName: parsed.pathname.slice(1),
  });
}

async function neonGet(path, { apiKey, fetchFn }) {
  const response = await fetchFn(`https://console.neon.tech/api/v2${path}`, {
    method: "GET",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${apiKey}`,
    },
  });
  if (!response.ok) {
    throw new TypeError(`Neon target lookup failed with HTTP ${response.status}`);
  }
  return response.json();
}

export async function verifyNeonTarget({
  connectionString,
  apiKey,
  pooled,
  fetchFn = globalThis.fetch,
}) {
  if (typeof apiKey !== "string" || apiKey.length < 21) {
    throw new TypeError("NEON_API_KEY is required for read-only target binding");
  }
  if (typeof fetchFn !== "function") throw new TypeError("a fetch implementation is required");
  const connection = parseNeonConnectionUrl(connectionString, { pooled });
  const [branchBody, endpointBody] = await Promise.all([
    neonGet(
      `/projects/${GENESIS_TARGET.projectId}/branches/${GENESIS_TARGET.branchId}`,
      { apiKey, fetchFn },
    ),
    neonGet(
      `/projects/${GENESIS_TARGET.projectId}/branches/${GENESIS_TARGET.branchId}/endpoints`,
      { apiKey, fetchFn },
    ),
  ]);
  const branch = BranchResponseSchema.parse(branchBody).branch;
  const endpoints = EndpointResponseSchema.parse(endpointBody).endpoints;
  const endpoint = endpoints.find((candidate) => (
    candidate.host === connection.endpointHostname
    && candidate.branch_id === GENESIS_TARGET.branchId
  ));
  if (
    branch.id !== GENESIS_TARGET.branchId
    || branch.project_id !== GENESIS_TARGET.projectId
    || branch.name !== GENESIS_TARGET.branchName
    || !endpoint
    || endpoint.project_id !== GENESIS_TARGET.projectId
    || endpoint.type !== "read_write"
    || endpoint.disabled === true
  ) {
    throw new TypeError("database URL is not the pinned production read-write Neon target");
  }
  return Object.freeze({
    projectId: branch.project_id,
    branchId: branch.id,
    branchName: branch.name,
    databaseName: connection.databaseName,
    endpointId: endpoint.id,
    pooled,
  });
}
