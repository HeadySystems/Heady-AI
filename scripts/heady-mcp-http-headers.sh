#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║  HEADY™ MCP HTTP Header Helper v1.0.0                          ║
# ║  Resolves MCP bearer headers from GCP Secret Manager           ║
# ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
# ╚══════════════════════════════════════════════════════════════════╝

set -euo pipefail

readonly GCP_PROJECT="${HEADY_GCP_PROJECT:-heady-ai}"
readonly SECRET_NAME="${HEADY_MCP_SECRET_NAME:-heady-mcp-bearer}"
readonly SECRET_VERSION="${HEADY_MCP_SECRET_VERSION:-2}"

if ! command -v gcloud >/dev/null 2>&1; then
  printf '%s\n' "gcloud is required to resolve Heady MCP credentials" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  printf '%s\n' "jq is required to encode Heady MCP headers" >&2
  exit 1
fi

bearer="$(gcloud secrets versions access "${SECRET_VERSION}" \
  --secret="${SECRET_NAME}" \
  --project="${GCP_PROJECT}" 2>/dev/null)"

if [[ -z "${bearer}" ]]; then
  printf '%s\n' "Heady MCP bearer resolved to an empty value" >&2
  exit 1
fi

jq -cn --arg bearer "${bearer}" '{Authorization: ("Bearer " + $bearer)}'
