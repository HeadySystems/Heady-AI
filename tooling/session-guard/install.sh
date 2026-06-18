#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║  HEADY™ session-guard installer — point this clone's git hooks at  ║
# ║  the tracked, version-controlled tooling/hooks directory.          ║
# ║  Idempotent. Run once per clone. © 2026 HeadySystems Inc.          ║
# ╚══════════════════════════════════════════════════════════════════╝
set -euo pipefail
REPO="$(git rev-parse --show-toplevel)"
cd "$REPO"
git config core.hooksPath tooling/hooks
chmod +x tooling/hooks/pre-commit tooling/hooks/pre-push tooling/session-guard/src/session-guard.mjs 2>/dev/null || true
echo "{\"t\":\"session-guard\",\"level\":\"info\",\"msg\":\"hooks installed\",\"hooksPath\":\"tooling/hooks\"}"
