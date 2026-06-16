# ADR-0028: Cross-Domain SSO Partitioned Cookie Governance

- **Status:** Accepted (2026-06-16)
- **Deciders:** Eric Anthony Haywood

## Context

The Heady ecosystem spans multiple domains (e.g. `headyme.com`, `headysystems.com`, `headyme.org`). Modern browser privacy architectures—specifically third-party cookie restrictions (Chrome's CHIPS, Safari's ITP)—block standard cross-domain session cookies. If a user logs into a service, they are immediately signed out when navigating to another subdomain, breaking the Single Sign-On (SSO) experience.

## Decision

1. **Unified Authentication Subdomain**: All auth actions, tokens, and callbacks must route through a unified, dedicated auth subdomain: **`auth.headysystems.com`**.
2. **Partitioned and Host-Only Cookies**: All session cookies issued by Heady must be configured with:
   * The **`Partitioned`** attribute (Cookies Having Independent Partitioned State - CHIPS) to allow cross-site cookie usage in secure partitions.
   * The **`__Host-`** prefix to enforce secure-only, path-locked, and origin-locked browser storage.
   * **`SameSite=None; Secure; HttpOnly`** parameters.
3. **Edge verification**: Firebase ID tokens will be decrypted and verified at the Cloudflare edge (Workers) using WebCrypto APIs (`firebase-auth-cloudflare-workers`). This removes the latency of origin server round-trips for authenticated static file serves.
4. **CORS Hardening**: Cross-Origin Resource Sharing (CORS) rules must match explicitly against our whitelisted domains; wildcard `*` is banned on authenticated endpoints.

## Consequences

- (+) Restores functional Single Sign-On across all Heady subdomains under modern privacy constraints.
- (+) Improves security by locking cookies to the origin hostname (`__Host-` prevents subdomain spoofing).
- (+) Eliminates database auth queries on the static file delivery path.
- (−) Requires explicit DNS delegation and SSL certificate binding for the auth subdomain.
- (−) Partitioned cookies are not supported on legacy browsers (unsupported in IE/legacy Edge, which is acceptable for this pre-launch monorepo).
