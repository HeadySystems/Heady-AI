#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║  HEADY™ ADR Acceptance Ceremony v1.0.0                          ║
# ║  Founder-run. Creates the OpenPGP-signed acceptance tags for the ║
# ║  Proposed ADRs, verifies each one, then records the acceptance in ║
# ║  the ADR bodies. An agent MUST NOT run this: ADR-0031 §2 and     ║
# ║  ADR-0013 reserve the founder signature to the founder, and      ║
# ║  ADR-0052 §2 makes a signed Git object the only sufficient       ║
# ║  evidence for ratifying a governance artifact.                   ║
# ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder               ║
# ╚══════════════════════════════════════════════════════════════════╝
#
# Usage:
#   bash scripts/adr-acceptance-ceremony.sh --check     # preconditions only, no writes
#   bash scripts/adr-acceptance-ceremony.sh --sign      # sign + verify + record + commit
#   bash scripts/adr-acceptance-ceremony.sh --push      # push the tags and the record commit
#
# gpg prompts for the passphrase on each tag. That prompt IS the human factor —
# if it does not appear, an agent or cached agent-session is signing for you: abort.

set -euo pipefail

readonly KEY_OF_RECORD="1050B59E7296C46C26DDF95DA7D2108BB3C6101C"
readonly BRANCH="checkpoint/rebuild-substrate-2026-07-23"
readonly REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# ADR number · file · expected sha256 at time of preparation (2026-08-22).
# A mismatch means the file changed after this script was written — re-read the
# ADR before signing it, then update the hash here deliberately.
readonly ADR_0052_FILE="docs/adr/0052-instruction-provenance-and-channel-authentication.md"
readonly ADR_0052_SHA="e5c114f94c22893816b485263400ddf84629db2ad466e35b9954f64e7ed715d2"
readonly ADR_0054_FILE="docs/adr/0054-domain-canon-carrier-closure.md"
# 0054 re-pinned 2026-08-22 after the founder directed that `headytrade` be removed
# from the ADR-0033 and legacy ADR-0019 snapshot tables. That required amending 0054
# §Decision to carry the bounded, founder-authorized exception to the ADR immutability
# rule — otherwise the record would have contradicted the tree. The hash below is the
# AMENDED text: re-read §Decision and §Consequences before signing.
readonly ADR_0054_SHA="c89b96ba9594ff269a1c35aca5809c26ef926e2637fc2d0a89e46975b06110a1"

log() { printf '%s\n' "$*" >&2; }
die() { printf 'ABORT: %s\n' "$*" >&2; exit 1; }

verify_file() {
  local file="$1" want="$2" got
  [[ -f "$file" ]] || die "$file is missing"
  got="$(sha256sum "$file" | cut -d' ' -f1)"
  [[ "$got" == "$want" ]] || die "$file changed since preparation
  expected $want
  actual   $got
  Re-read the ADR, then update the hash in this script on purpose."
  log "  ok  $file  $got"
}

preconditions() {
  log "── preconditions ────────────────────────────────────────────"

  local branch; branch="$(git rev-parse --abbrev-ref HEAD)"
  [[ "$branch" == "$BRANCH" ]] || die "on branch '$branch', expected '$BRANCH'"
  log "  ok  branch $branch"

  # A dirty tree blocks signing (the record commit must contain only the ADR
  # bodies) but must not block --check, since on this checkout a peer agent's
  # unrelated in-flight work is the normal state, not an error.
  local dirty; dirty="$(git status --porcelain --untracked-files=no)"
  if [[ -n "$dirty" ]]; then
    if [[ "${CEREMONY_MODE:-}" == "--sign" ]]; then
      die "working tree has tracked modifications — commit or stash them first, then re-run:
$dirty
  A peer agent may hold staged work in the shared index: check 'git status --short'
  and 'git stash list' before assuming it is yours."
    fi
    log "  warn tracked modifications present (blocks --sign, not --check):"
    printf '       %s\n' "$dirty" >&2
  else
    log "  ok  no tracked modifications"
  fi

  gpg --list-secret-keys "$KEY_OF_RECORD" >/dev/null 2>&1 \
    || die "the ADR-0031 key of record $KEY_OF_RECORD is not in this keyring"
  log "  ok  key of record present: $KEY_OF_RECORD"

  local configured; configured="$(git config --get user.signingkey || true)"
  [[ -n "$configured" ]] || die "git config user.signingkey is unset"
  log "  ok  user.signingkey $configured (gpg delegates to its [S] subkey)"

  verify_file "$ADR_0052_FILE" "$ADR_0052_SHA"
  verify_file "$ADR_0054_FILE" "$ADR_0054_SHA"

  log "  note ADR-0053 lives on branch governance/solo-founder-quorum-amendment-20260822"
  log "       (PR 288). Merge that PR first, then re-run: this script signs what is"
  log "       reachable from HEAD and will not tag an ADR it cannot see."
  if git cat-file -e "HEAD:docs/adr/0053-temporary-solo-founder-approval-quorum.md" 2>/dev/null; then
    log "  ok  ADR-0053 IS reachable from HEAD — it will be included"
    ADR_0053_PRESENT=1
  else
    log "  --  ADR-0053 not reachable from HEAD — it will be SKIPPED"
    ADR_0053_PRESENT=0
  fi
}

# sign_one <adr-number> <title> <file> <sha256>
sign_one() {
  local n="$1" title="$2" file="$3" sha="$4"
  local short tag
  short="$(git rev-parse --short=9 HEAD)"
  tag="adr-${n}-accepted-${short}"

  if git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then
    log "  --  $tag already exists — skipping (tags are not re-signed)"
    return 0
  fi

  log "── signing $tag ─────────────────────────────────────────────"
  git tag -s "$tag" -m "Founder acceptance: ADR-${n} ${title}; accepted object ${short}; file ${file}; sha256 ${sha}"

  # Fail closed: an unverifiable tag is worse than no tag.
  git tag -v "$tag" 2>&1 | grep -q "Good signature" \
    || die "$tag does not verify — delete it with 'git tag -d $tag' and investigate"
  git tag -v "$tag" 2>&1 | grep -q "$KEY_OF_RECORD" \
    || die "$tag was signed by a key other than the key of record $KEY_OF_RECORD"
  log "  ok  $tag verifies against the key of record"
  printf '%s\n' "$tag"
}

# record_one <adr-number> <file> <tag>
record_one() {
  local n="$1" file="$2" tag="$3" today
  today="$(date -u +%Y-%m-%d)"
  python3 - "$file" "$tag" "$today" "$KEY_OF_RECORD" <<'PY'
import re, sys
path, tag, today, key = sys.argv[1:5]
text = open(path).read()
# Replace the first Status bullet, and insert the Acceptance bullet after it,
# matching the format ADR-0051 established.
pattern = re.compile(r"^- \*\*Status:\*\*.*$", re.MULTILINE)
match = pattern.search(text)
if not match:
    sys.exit(f"{path}: no '- **Status:**' bullet to update")
replacement = (
    f"- **Status:** Accepted ({today})\n"
    f"- **Acceptance:** Founder-signed tag `{tag}` (OpenPGP, EDDSA `{key}` — the key of "
    f"record; `git tag -v {tag}` returns Good signature)"
)
open(path, "w").write(text[:match.start()] + replacement + text[match.end():])
print(f"  ok  recorded acceptance in {path}")
PY
}

main() {
  local mode="${1:---check}"
  export CEREMONY_MODE="$mode"
  preconditions

  case "$mode" in
    --check)
      log ""
      log "Preconditions pass. Nothing was written. Re-run with --sign to perform the ceremony."
      ;;
    --sign)
      local tag52 tag54 tag53=""
      tag52="$(sign_one 0052 "Instruction Provenance and Channel Authentication" "$ADR_0052_FILE" "$ADR_0052_SHA" | tail -1)"
      tag54="$(sign_one 0054 "Domain Canon Carrier Closure and HeadyFinance Succession" "$ADR_0054_FILE" "$ADR_0054_SHA" | tail -1)"
      if [[ "${ADR_0053_PRESENT:-0}" == "1" ]]; then
        local f53="docs/adr/0053-temporary-solo-founder-approval-quorum.md"
        tag53="$(sign_one 0053 "Temporary Solo-Founder Approval Quorum" "$f53" "$(sha256sum "$f53" | cut -d' ' -f1)" | tail -1)"
      fi

      log "── recording acceptance in the ADR bodies ───────────────────"
      record_one 0052 "$ADR_0052_FILE" "$tag52"
      record_one 0054 "$ADR_0054_FILE" "$tag54"
      [[ -n "$tag53" ]] && record_one 0053 "docs/adr/0053-temporary-solo-founder-approval-quorum.md" "$tag53"

      log "── gates ───────────────────────────────────────────────────"
      node tooling/law-lint/src/law-lint.mjs
      node tooling/governance-gate/src/governance-gate.mjs

      git commit -S -m "docs(adr): record founder acceptance of the proposed ADRs

Acceptance of record is the founder-signed tag on each line, verifiable with
'git tag -v' against the ADR-0031 key $KEY_OF_RECORD. Per ADR-0052 §2 a signed
Git object is the only evidence sufficient to ratify a governance artifact; the
Status bullets here are the human-readable projection of those tags, not the
acceptance itself." -- \
        "$ADR_0052_FILE" "$ADR_0054_FILE" \
        ${tag53:+docs/adr/0053-temporary-solo-founder-approval-quorum.md}

      log ""
      log "Signed and recorded. Review 'git show', then run: bash $0 --push"
      ;;
    --push)
      git push origin "$BRANCH"
      git push origin --tags
      log "Pushed the record commit and the acceptance tags."
      ;;
    *)
      die "unknown mode '$mode' — use --check, --sign, or --push"
      ;;
  esac
}

main "$@"
