// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ MCP Bearer Authentication v1.0.0                         ║
// ║  Fail-closed authentication decisions for remote MCP transports. ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
// ╚══════════════════════════════════════════════════════════════════╝

import { timingSafeEqual } from "node:crypto";

export const MCP_BEARER_ENV = "HEADY_MCP_BEARER";

const BEARER_PREFIX = "Bearer ";
const HTTP_UNAUTHORIZED = 401;
const HTTP_SERVICE_UNAVAILABLE = 503;

export function isMcpBearerConfigured(expectedToken = process.env[MCP_BEARER_ENV]) {
  return typeof expectedToken === "string" && expectedToken.length > 0;
}

export function isValidMcpAuthorization(authorization, expectedToken = process.env[MCP_BEARER_ENV]) {
  if (!isMcpBearerConfigured(expectedToken)) return false;
  if (typeof authorization !== "string" || !authorization.startsWith(BEARER_PREFIX)) return false;

  const presented = Buffer.from(authorization.slice(BEARER_PREFIX.length), "utf8");
  const expected = Buffer.from(expectedToken, "utf8");
  return presented.length === expected.length && timingSafeEqual(presented, expected);
}

export function getMcpAuthorizationDecision(authorization, expectedToken = process.env[MCP_BEARER_ENV]) {
  if (!isMcpBearerConfigured(expectedToken)) {
    return {
      allowed: false,
      status: HTTP_SERVICE_UNAVAILABLE,
      error: "mcp_auth_not_configured",
    };
  }

  if (!isValidMcpAuthorization(authorization, expectedToken)) {
    return {
      allowed: false,
      status: HTTP_UNAUTHORIZED,
      error: "mcp_unauthorized",
    };
  }

  return { allowed: true, status: 200, error: null };
}
