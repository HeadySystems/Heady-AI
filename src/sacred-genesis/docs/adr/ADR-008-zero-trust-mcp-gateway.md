# ADR-008: Zero-Trust MCP Gateway Architecture

## Status
Accepted

## Date
2026-02-01

## Context
The Model Context Protocol (MCP) gateway enables AI agents to execute tools across the Heady platform. Tool execution is inherently dangerous — tools can access filesystems, make network requests, modify databases, and interact with external APIs. A compromised or misbehaving agent could use tool execution to exfiltrate data, modify system state, or attack external services. The MCP gateway must enforce strict security boundaries while remaining performant enough for real-time agent interactions.

## Decision
We implement a zero-trust MCP gateway where every request is authenticated, every tool execution is sandboxed, and every result is validated. The gateway uses CSL-gated routing that measures cosine similarity between request embeddings and tool capability vectors, rejecting requests that fall below the phi-derived threshold for their security level. Tool execution occurs in isolated WASM sandboxes with memory limits following Fibonacci sizing (default fib(11) = 89MB, maximum fib(13) = 233MB).

All connections require mutual TLS with certificate pinning. IP classification with geo-guarding restricts tool access based on geographic origin. Role-based access control maps user identities to tool permissions. Every execution is logged to an append-only Merkle tree audit trail with cryptographic integrity verification.

Connection pooling uses phi-derived pool sizes (fib(5) = 5 minimum, fib(7) = 13 default, fib(9) = 34 maximum per server). Circuit breaker isolation with phi-backoff prevents failing tool servers from cascading failures.

## Consequences

### Benefits
Zero-trust eliminates the "trusted internal network" assumption that enables lateral movement attacks. CSL-gated routing provides semantic-level protection against prompt injection — even if an agent is tricked into requesting an inappropriate tool, the routing layer detects the semantic mismatch and rejects the request. WASM sandboxing prevents tool execution from accessing unauthorized resources. Merkle tree audit trails provide tamper-evident records that satisfy compliance requirements.

### Risks
The multiple security layers add latency to tool execution. We mitigate this by caching authentication decisions, pre-computing CSL gate vectors, and maintaining warm connection pools. Over-restrictive security policies could prevent legitimate tool execution. We provide graduated security levels (MINIMUM through CRITICAL) that allow administrators to tune the security-usability balance for different tool categories.

### Related ADRs
ADR-001 (CSL engine), ADR-004 (circuit breaker), ADR-007 (session management)
