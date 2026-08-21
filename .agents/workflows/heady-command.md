---
description: Compatibility alias for the canonical authority-aware /heady intelligence router
---

<!-- HEADY_BRAND:BEGIN
╔══════════════════════════════════════════════════════════════════╗
║  HEADY™ Command Compatibility Alias v2.0.0                       ║
║  Routes legacy heady-command usage into the canonical /heady.    ║
║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
╚══════════════════════════════════════════════════════════════════╝
HEADY_BRAND:END -->

# Heady Command Compatibility Alias

Treat the complete user input as `/heady <input>` and follow
`.agents/workflows/heady.md`. Do not use the removed legacy CommonJS service
map, fabricate an unavailable endpoint, or broaden the user's authority.

This alias exists so historical `/heady-command` invocations converge on the
same current routing contract. It must never recursively invoke itself.
