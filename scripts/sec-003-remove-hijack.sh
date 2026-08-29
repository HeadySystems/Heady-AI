#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║  HEADY™ SEC-003 step 3 — remove the hijacked edge               ║
# ║  Deletes the zone route then the script, per quarantined entry   ║
# ║  in configs/edge-inventory.json.                                 ║
# ║                                                                  ║
# ║  DESTRUCTIVE. Deletes routes before scripts, because removing the ║
# ║  script first 5xxs the domain instead of 404ing it.              ║
# ║  Made with ❤️ by HeadySystems Inc.                               ║
# ╚══════════════════════════════════════════════════════════════════╝
#
#   bash scripts/sec-003-remove-hijack.sh --dry-run   # print the plan, change nothing
#   bash scripts/sec-003-remove-hijack.sh --apply     # delete routes then scripts
#
# Requires CLOUDFLARE_API_TOKEN (a NEW post-rotation token) and
# CLOUDFLARE_ACCOUNT_ID in the environment.

set -euo pipefail

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

  # The operating token must actually carry Workers Scripts Write, or the
  # deletes will 403 halfway through and leave a partly-removed edge.
  local id
  id="$(cf "$API/user/tokens/verify" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("result",{}).get("id",""))')"
  [[ -n "$id" ]] || die "token verification failed — cannot establish which credential is in use"
  log "  ok  operating token $id verified"

  # NOTE: an earlier revision of this script gated on a specific token id it
  # believed was the pre-incident credential. That was wrong — the token in
  # .env is heady-rebuild-scoped-2026-07-23, issued 17 days AFTER the hijack.
  # The real residual risk is the pre-incident tokens that carry
  # "API Tokens Write" and can mint a replacement; those are tracked in the
  # incident record, not gated here, because leaving the hijack live is the
  # larger and certain harm.
}

# Cache the account's zones once; routes are per-zone and we need every zone.
ZONES_CACHE=""
load_zones() {
  [[ -n "$ZONES_CACHE" ]] && return 0
  ZONES_CACHE="$(cf "$API/zones?account.id=$CLOUDFLARE_ACCOUNT_ID&per_page=200" \
    | python3 -c 'import json,sys
d=json.load(sys.stdin)
for z in d.get("result",[]): print(z["id"], z["name"], sep="\t")')"
  local n; n="$(printf '%s\n' "$ZONES_CACHE" | grep -c . || true)"
  log "  ok  ${n} zone(s) loaded"
}

# Build the account-wide route map ONCE into a temp file. Querying per script
# would be zones × scripts requests (61 × 20 here), which trips Cloudflare's
# per-user rate limit long before it finishes.
ROUTE_MAP=""
build_route_map() {
  [[ -n "$ROUTE_MAP" ]] && return 0
  load_zones
  ROUTE_MAP="$(mktemp)"
  trap 'rm -f "$ROUTE_MAP"' EXIT
  local zones; zones="$(printf '%s\n' "$ZONES_CACHE" | grep -c . || true)"
  log "  .. mapping routes across ${zones} zone(s)"
  while IFS=$'\t' read -r zone_id zone_name; do
    [[ -n "$zone_id" ]] || continue
    cf "$API/zones/$zone_id/workers/routes" \
      | ZONE="$zone_id" python3 -c '
import json,os,sys
try: d=json.load(sys.stdin)
except Exception: sys.exit(0)
for r in d.get("result") or []:
    if r.get("script"):
        print(r["script"], os.environ["ZONE"], r["id"], r.get("pattern",""), sep="\t")' >> "$ROUTE_MAP"
  done <<< "$ZONES_CACHE"
  log "  ok  $(wc -l < "$ROUTE_MAP") bound route(s) mapped"
}

# Emit "zone_id<TAB>route_id<TAB>pattern" for every route bound to $1.
routes_for() {
  build_route_map
  awk -F'\t' -v s="$1" '$1==s {print $2"\t"$3"\t"$4}' "$ROUTE_MAP"
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

  build_route_map
  local scripts; scripts="$(quarantined_scripts)"
  local count; count="$(printf '%s\n' "$scripts" | grep -c . || true)"
  log "── ${count} quarantined script(s) ────────────────────────────"

  while read -r script; do
    [[ -n "$script" ]] || continue
    if [[ "$mode" == "--apply" ]]; then
      # Route first: while the route exists the script still serves traffic,
      # and a script deleted out from under a live route leaves the domain
      # erroring rather than cleanly unrouted.
      while IFS=$'\t' read -r zone_id route_id pattern; do
        [[ -n "$route_id" ]] || continue
        log "    route $pattern → deleting"
        cf -X DELETE "$API/zones/$zone_id/workers/routes/$route_id" \
          | python3 -c 'import json,sys; d=json.load(sys.stdin); print("      ->", "ok" if d.get("success") else d.get("errors"))'
      done < <(routes_for "$script")
      log "  deleting script $script"
      cf -X DELETE "$API/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/scripts/$script?force=true" \
        | python3 -c 'import json,sys; d=json.load(sys.stdin); print("    ->", "ok" if d.get("success") else d.get("errors"))'
    else
      log "  would delete: $script"; routes_for "$script" | while IFS=$'\t' read -r z r p; do log "      route $p"; done
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
