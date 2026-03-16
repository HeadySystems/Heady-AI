#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# SYS-005: Ed25519 Key Generation Script
# SYS-003: Creates signing infrastructure for pipeline trust receipts
# © 2026 HeadySystems Inc. — 60+ Provisional Patents
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

PKI_DIR="$(dirname "$0")"
KEY_FILE="${PKI_DIR}/ed25519-receipt-key.pem"
PUB_FILE="${PKI_DIR}/ed25519-receipt-key.pub"

if [ -f "$KEY_FILE" ]; then
  echo "[SYS-005] Ed25519 key already exists at $KEY_FILE"
  echo "[SYS-005] To regenerate, delete the existing key first"
  exit 0
fi

echo "[SYS-005] Generating Ed25519 keypair for pipeline trust receipts..."
openssl genpkey -algorithm Ed25519 -out "$KEY_FILE" 2>/dev/null
openssl pkey -in "$KEY_FILE" -pubout -out "$PUB_FILE" 2>/dev/null

chmod 600 "$KEY_FILE"
chmod 644 "$PUB_FILE"

echo "[SYS-005] ✓ Private key: $KEY_FILE (600)"
echo "[SYS-005] ✓ Public key:  $PUB_FILE (644)"
echo "[SYS-003] Ed25519 signing infrastructure ready for trust receipts"
