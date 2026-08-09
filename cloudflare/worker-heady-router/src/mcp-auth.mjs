// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Edge MCP Bearer Authentication v1.0.0                    ║
// ║  Constant-shape bearer validation at the public MCP edge.        ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
// ╚══════════════════════════════════════════════════════════════════╝

const BEARER_PREFIX = "Bearer ";
const MCP_EXACT_PATHS = new Set(["/sse"]);
const MCP_PATH_PREFIXES = Object.freeze(["/mcp", "/vector"]);

async function digestToken(token) {
  const bytes = new TextEncoder().encode(token);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}

export function isProtectedMcpPath(pathname) {
  return MCP_EXACT_PATHS.has(pathname)
    || MCP_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function isValidMcpAuthorization(authorization, expectedToken) {
  if (typeof expectedToken !== "string" || expectedToken.length === 0) return false;
  if (typeof authorization !== "string" || !authorization.startsWith(BEARER_PREFIX)) return false;

  const presentedDigest = await digestToken(authorization.slice(BEARER_PREFIX.length));
  const expectedDigest = await digestToken(expectedToken);
  let difference = presentedDigest.length ^ expectedDigest.length;
  for (let index = 0; index < presentedDigest.length; index += 1) {
    difference |= presentedDigest[index] ^ expectedDigest[index];
  }
  return difference === 0;
}
