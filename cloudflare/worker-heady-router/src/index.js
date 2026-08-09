// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Edge Router — Cloudflare Worker                            ║
// ║  Transparent reverse proxy fronting the Heady domains onto the      ║
// ║  live origin, with MCP passthrough for headymcp.com (the /sse       ║
// ║  Streamable-SSE surface + /health). Origin is env-derived          ║
// ║  (HEADY_ORIGIN) — no hardcoded URLs (AGENTS.md #4); fail-closed     ║
// ║  503 when unconfigured. Replaces the prior KV-hologram/Colab-       ║
// ║  compiler router, which pointed at a decommissioned us-east1 origin ║
// ║  and a dead compile webhook (AGENTS.md: no dead-end integrations).  ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝

// Hosts that speak the MCP surface (tagged for origin-side routing/telemetry).
import { isProtectedMcpPath, isValidMcpAuthorization } from "./mcp-auth.mjs";

const MCP_HOSTS = new Set(["headymcp.com", "www.headymcp.com"]);

// Hop-by-hop response headers a proxy must not forward verbatim.
const STRIP_RESPONSE_HEADERS = ["transfer-encoding", "connection", "keep-alive"];

export default {
  async fetch(request, env) {
    const origin = env && env.HEADY_ORIGIN;
    if (!origin) {
      // Fail-closed: an unconfigured router must not silently hardcode a target.
      return new Response(
        JSON.stringify({ error: "router_unconfigured", detail: "HEADY_ORIGIN is not set" }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }

    let originHost;
    try {
      originHost = new URL(origin).host;
    } catch {
      return new Response(
        JSON.stringify({ error: "router_misconfigured", detail: "HEADY_ORIGIN is not a valid URL" }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }

    const url = new URL(request.url);
    const host = url.hostname;

    if (MCP_HOSTS.has(host) && isProtectedMcpPath(url.pathname)) {
      if (!env.HEADY_MCP_BEARER) {
        return new Response(
          JSON.stringify({ error: "mcp_auth_not_configured" }),
          { status: 503, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
        );
      }

      const authorized = await isValidMcpAuthorization(
        request.headers.get("Authorization"),
        env.HEADY_MCP_BEARER,
      );
      if (!authorized) {
        return new Response(
          JSON.stringify({ error: "mcp_unauthorized" }),
          {
            status: 401,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
              "WWW-Authenticate": 'Bearer realm="heady-mcp"',
            },
          },
        );
      }
    }

    // Forward with the visitor's identity preserved; the origin sees who it is for.
    const headers = new Headers(request.headers);
    headers.set("Host", originHost);
    headers.set("X-Forwarded-Host", host);
    headers.set("X-Heady-Edge", "worker-heady-router");
    if (MCP_HOSTS.has(host)) headers.set("X-Heady-Module", "mcp-gateway");

    const init = { method: request.method, headers, redirect: "manual" };
    if (request.method !== "GET" && request.method !== "HEAD") init.body = request.body;

    let response;
    try {
      response = await fetch(`${origin}${url.pathname}${url.search}`, init);
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "origin_unreachable", detail: String(err && err.message ? err.message : err) }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    // Rewrite any origin-host redirect Location back onto the caller's host.
    const out = new Headers(response.headers);
    for (const h of STRIP_RESPONSE_HEADERS) out.delete(h);
    const location = out.get("Location");
    if (location && location.includes(originHost)) {
      out.set("Location", location.split(originHost).join(host));
    }
    out.set("X-Heady-Origin", originHost);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: out,
    });
  },
};
