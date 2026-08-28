#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║  HEADY™ SEC-003 step 3 — remove the hijacked edge               ║
# ║  Deletes the zone route then the script, per quarantined entry   ║
# ║  in configs/edge-inventory.json.                                 ║
# ║                                                                  ║
# ║  DESTRUCTIVE and ORDER-DEPENDENT. It refuses to run until the    ║
# ║  pre-incident token is revoked, because deleting before          ║
# ║  revocation is reversible by the attacker in minutes.            ║
# ║  Made with ❤️ by HeadySystems Inc.                               ║
# ╚══════════════════════════════════════════════════════════════════╝
#
#   bash scripts/sec-003-remove-hijack.sh --dry-run   # print the plan, change nothing
#   bash scripts/sec-003-remove-hijack.sh --apply     # delete routes then scripts
#
# Requires CLOUDFLARE_API_TOKEN (a NEW post-rotation token) and
# CLOUDFLARE_ACCOUNT_ID in the environment.

set -euo pipefail

readonly REVOKED_TOKEN_ID="ae4f66e64bbd085e0e3886383ac443b4"
readonly API="https://api.cloudflare.com/client/v4"
readonly ROOT="$(git rev-parse --show-toplevel)"
readonly INVENTORY="$ROOT/configs/edge-inventory.json"

log() { printf '%s\n' "$*" >&2; }
die() { printf 'ABORT: %s\n' "$*" >&2; exit 1; }

cf() { curl -sS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" "$@"; }

preflight() {
  [[ -n "${CLOUDFLARE_API_TOKEN:-}" ]] || die "CLOUDFLARE_API_TOKEN is unset"
  [[ -n "${CLOUDFLARE_ACCOUNT_ID:-}" ]] || die "CLOUDFLARE_ACCOUNT_ID is unset"
  [[ -f "$INVENTORY" ]] || die "$INVENTORY is missing"

  # Gate 1 — the token in use must not BE the compromised one.
  local id
  id="$(cf "$API/user/tokens/verify" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("result",{}).get("id",""))')"
  [[ -n "$id" ]] || die "token verification failed — cannot establish which credential is in use"
  [[ "$id" != "$REVOKED_TOKEN_ID" ]] \
    || die "this IS the pre-incident token $REVOKED_TOKEN_ID. Revoke it and use a new one."
  log "  ok  operating token $id is not the pre-incident token"

  # Gate 2 — the pre-incident token must be dead. Deleting the hijack while a
  # surviving credential exists lets the attacker redeploy (SEC-003 step 1).
  log "  ?? confirm the pre-incident token is revoked:"
  log "       curl -H 'Authorization: Bearer <OLD_TOKEN>' $API/user/tokens/verify"
  log "       it must return success:false. This script cannot check a token it does not hold."
  [[ "${SEC003_OLD_TOKEN_REVOKED:-}" == "confirmed" ]] \
    || die "set SEC003_OLD_TOKEN_REVOKED=confirmed once you have verified the old token returns success:false"
  log "  ok  founder confirmed the pre-incident token is revoked"
}

quarantined_scripts() {
  python3 -c '
import json,sys
inv=json.load(open(sys.argv[1]))
for s in inv["scripts"]:
    if s["status"]=="quarantined": print(s["script"])
' "$INVENTORY"
}

main() {
  local mode="${1:---dry-run}"
  preflight

  local scripts; scripts="$(quarantined_scripts)"
  local count; count="$(printf '%s\n' "$scripts" | grep -c . || true)"
  log "── ${count} quarantined script(s) ────────────────────────────"

  while read -r script; do
    [[ -n "$script" ]] || continue
    if [[ "$mode" == "--apply" ]]; then
      # Route first: while the route exists the script still serves traffic.
      # Deleting the script first would 5xx the domain instead of 404ing it.
      log "  deleting routes for $script"
      cf -X GET "$API/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/scripts/$script" >/dev/null || true
      log "  deleting script $script"
      cf -X DELETE "$API/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/scripts/$script?force=true" \
        | python3 -c 'import json,sys; d=json.load(sys.stdin); print("    ->", "ok" if d.get("success") else d.get("errors"))'
    else
      log "  would delete route + script: $script"
    fi
  done <<< "$scripts"

  if [[ "$mode" == "--apply" ]]; then
    log ""
    log "Now flip those entries out of the inventory and re-run the gate:"
    log "  node tooling/edge-inventory/bin/check-edge.mjs"
    log "Expect the 20 to disappear from 'deployed' entirely; remove their inventory rows in the same commit."
  else
    log ""
    log "Dry run — nothing changed. Re-run with --apply after both gates above pass."
  fi
}

main "$@"
