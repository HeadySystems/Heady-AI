<!-- HEADY_BRAND:BEGIN
<!-- ╔══════════════════════════════════════════════════════════════════╗
<!-- ║  HEADY™ CHANGELOG                                                 ║
<!-- ║  ∞ SACRED GEOMETRY ∞  Provenance · Traceability                  ║
<!-- ║  FILE: CHANGELOG.md · LAYER: root                                ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
# Changelog

All notable changes to this repository are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); releases run only from
this canonical repo (ADR-0001). Both `main` and `rebuild` are first-class,
always-deployable branches (`docs/DUAL_ACTIVE_BRANCH_STRATEGY.md`).

## [Unreleased]

### Added
- Filesystem audit registries under `configs/liquid-os/`: `node-registry.yaml`,
  `bee-catalog.yaml`, `agent-registry.yaml`, `workflow-registry.yaml`.
- MCP tool manifest `configs/mcp-tools.json` and discovery `/.well-known/mcp.json`
  reflecting the 40 `heady_*` tools exported by `src/heady-mcp-server.js`.
- Root governance docs: `CONTRIBUTING.md`, `SECURITY.md`, `ARCHITECTURE.md`,
  and this `CHANGELOG.md`.

### Changed
- `configs/service-catalog.yaml` expanded from a placeholder stub to the full
  19-service Latent Service catalog derived from `heady-registry.json`.

---

*∞ Sacred Geometry · Liquid Intelligence · Permanent Life ∞*
*© 2026 HeadySystems Inc. — Eric Haywood, Founder*
