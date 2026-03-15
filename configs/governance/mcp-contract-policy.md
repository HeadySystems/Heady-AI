# Heady™ MCP Interface Contract Policy
# Version: 1.0.0 | Updated: 2026-03-15

## Principle
> "All tool capabilities must be exposed through a versioned MCP contract."
> "Internal subsystems may change, MCP compatibility remains stable."

## Contract Rules

### Tool Registration
- Every HeadyMCP tool MUST have a versioned schema (v1, v2, etc.)
- Tool schemas are defined in `mcp-servers/schemas/` directory
- Breaking changes require a new version number (v1 → v2)
- Deprecated versions remain available for 90 days minimum

### Interface Stability
- MCP tool names are **immutable** once published
- Parameter types may only be **extended** (new optional params), never removed
- Response schemas use **additive-only** changes
- Transport: Streamable HTTP (preferred) or stdio — SSE is deprecated

### Versioning
- Schema version in tool metadata: `{ version: "v1", ... }`
- Changelog maintained in `mcp-servers/CHANGELOG.md`
- Consumers declare minimum supported version

### Testing
- Every MCP tool has integration tests in `tests/mcp/`
- Contract tests verify backward compatibility on every PR
- Load tests validate φ-scaled rate limits (1.618× burst, 0.618× sustained)

## Architecture
```
┌─────────────────┐
│  External LLMs  │ ← MCP Protocol (stable contract)
├─────────────────┤
│  HeadyMCP       │ ← Version router
├─────────────────┤
│  Internal APIs  │ ← Implementation (swappable)
└─────────────────┘
```
