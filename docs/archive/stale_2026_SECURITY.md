# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability in the Heady AI Platform, please report it responsibly:

**Email:** [e@headyconnection.org](mailto:e@headyconnection.org)

Please include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested remediation (if any)

## Security Model

### Post-Quantum Cryptography

- **ML-KEM** (FIPS 203) for key encapsulation
- **ML-DSA** (FIPS 204) for digital signatures
- Hybrid signatures for all inter-service mesh communications

### Defense-in-Depth Layers

1. **Rate Limiting** — Redis sliding-window (120 req/min for Pro, auto-ban on violation)
2. **PQC Handshake** — ML-KEM key encapsulation + ML-DSA signatures
3. **Mutual TLS** — PQC-signed certificates for all mesh traffic
4. **IP Classification** — Trade secret tiering (PUBLIC → INTERNAL → PROPRIETARY → RESTRICTED)
5. **Secret Rotation** — 24-hour automated key rotation
6. **Code Obfuscation** — V8 Bytecode + AST mangling for production

### Supported Versions

| Version | Supported |
|---------|-----------|
| 3.x     | ✅ Active |
| 2.x     | ❌ EOL    |
| 1.x     | ❌ EOL    |

## Disclosure Timeline

- **Day 0:** Vulnerability reported via email
- **Day 1:** Acknowledgment sent
- **Day 7:** Fix developed and tested
- **Day 14:** Patch released, advisory published
