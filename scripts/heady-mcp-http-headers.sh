#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║  HEADY™ MCP HTTP Header Helper v1.1.0                          ║
# ║  Resolves MCP bearer headers through sandbox-safe ADC          ║
# ║  Made with ❤️ by HeadySystems Inc.                             ║
# ╚══════════════════════════════════════════════════════════════════╝

set -euo pipefail

readonly GCP_PROJECT="${HEADY_GCP_PROJECT:-heady-ai}"
readonly SECRET_NAME="${HEADY_MCP_SECRET_NAME:-heady-mcp-bearer}"
readonly SECRET_VERSION="${HEADY_MCP_SECRET_VERSION:-latest}"
readonly HOST_GCLOUD_CONFIG="${CLOUDSDK_CONFIG:-${XDG_CONFIG_HOME:-${HOME}/.config}/gcloud}"
readonly CREDENTIAL_FILE="${CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE:-${GOOGLE_APPLICATION_CREDENTIALS:-${HOST_GCLOUD_CONFIG}/application_default_credentials.json}}"

if ! command -v gcloud >/dev/null 2>&1; then
  printf '%s\n' "gcloud is required to resolve Heady MCP credentials" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  printf '%s\n' "jq is required to encode Heady MCP headers" >&2
  exit 1
fi

if [[ ! -r "${CREDENTIAL_FILE}" ]]; then
  printf '%s\n' \
    "Heady MCP requires readable Application Default Credentials or a workload identity credential file" >&2
  exit 1
fi

umask 077
runtime_config="$(mktemp -d "${TMPDIR:-/tmp}/heady-mcp-gcloud.XXXXXX")"

cleanup() {
  if [[ -n "${runtime_config:-}" && -d "${runtime_config}" ]]; then
    rm -rf -- "${runtime_config}"
  fi
}
trap cleanup EXIT

# Codex executes HTTP-header helpers with the user's Cloud SDK configuration
# read-only. A disposable config prevents gcloud from locking or rewriting it,
# while ADC or workload identity supplies access to Secret Manager.
export CLOUDSDK_CONFIG="${runtime_config}"
export CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE="${CREDENTIAL_FILE}"
export CLOUDSDK_CORE_DISABLE_FILE_LOGGING=true

if ! bearer="$(gcloud secrets versions access "${SECRET_VERSION}" \
  --secret="${SECRET_NAME}" \
  --project="${GCP_PROJECT}" \
  --quiet)"; then
  printf '%s\n' \
    "Heady MCP credential resolution failed; refresh ADC or repair workload identity access" >&2
  exit 1
fi

if [[ -z "${bearer}" ]]; then
  printf '%s\n' "Heady MCP bearer resolved to an empty value" >&2
  exit 1
fi

printf '%s' "${bearer}" | jq -Rsc '{Authorization: ("Bearer " + .)}'
