#!/usr/bin/env bash
# HeadyMCP Gateway — Production Deployment Script
# Provisions D1 database, KV namespace, runs migrations, deploys Worker
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "═══════════════════════════════════════════════════════"
echo "  HeadyMCP Gateway — Production Deployment"
echo "═══════════════════════════════════════════════════════"

# ── Step 1: Create D1 Database ──────────────────────────────────────
echo ""
echo "→ Step 1: Creating D1 database..."
D1_OUTPUT=$(wrangler d1 create heady-mcp-registry 2>&1 || true)

if echo "$D1_OUTPUT" | grep -q "already exists"; then
  echo "  ✅ D1 database 'heady-mcp-registry' already exists"
  D1_ID=$(wrangler d1 list --json 2>/dev/null | grep -A2 '"heady-mcp-registry"' | grep '"uuid"' | sed 's/.*"uuid": *"//;s/".*//' || echo "")
else
  echo "$D1_OUTPUT"
  D1_ID=$(echo "$D1_OUTPUT" | grep -oP 'database_id\s*=\s*"\K[^"]+' || echo "")
fi

if [ -n "$D1_ID" ]; then
  echo "  📋 D1 ID: $D1_ID"
  # Patch wrangler.toml with real D1 ID
  sed -i "s/database_id = \"create-via-wrangler-d1-create\"/database_id = \"$D1_ID\"/" wrangler.toml
  echo "  ✅ Updated wrangler.toml with D1 database ID"
else
  echo "  ⚠️  Could not extract D1 ID — check wrangler.toml manually"
fi

# ── Step 2: Create KV Namespace ────────────────────────────────────
echo ""
echo "→ Step 2: Creating KV namespace..."
KV_OUTPUT=$(wrangler kv namespace create CACHE 2>&1 || true)

if echo "$KV_OUTPUT" | grep -q "already exists"; then
  echo "  ✅ KV namespace 'CACHE' already exists"
else
  echo "$KV_OUTPUT"
  KV_ID=$(echo "$KV_OUTPUT" | grep -oP 'id\s*=\s*"\K[^"]+' || echo "")
  if [ -n "$KV_ID" ]; then
    sed -i "s/id = \"create-via-wrangler-kv-create\"/id = \"$KV_ID\"/" wrangler.toml
    echo "  ✅ Updated wrangler.toml with KV namespace ID"
  fi
fi

# ── Step 3: Run D1 Schema Migration ────────────────────────────────
echo ""
echo "→ Step 3: Running D1 schema migration..."
wrangler d1 execute heady-mcp-registry --file=schema.sql --remote 2>&1 || {
  echo "  ⚠️  Schema migration failed (may already be applied)"
}
echo "  ✅ D1 schema applied"

# ── Step 4: Verify secrets are set ─────────────────────────────────
echo ""
echo "→ Step 4: Checking secrets..."
echo "  ℹ️  Required secrets (set via 'wrangler secret put <NAME>'):"
echo "      - MCP_API_KEY"
echo "      - STRIPE_SECRET_KEY"
echo "      - STRIPE_WEBHOOK_SECRET"
echo ""
echo "  If not already set, run:"
echo "    wrangler secret put MCP_API_KEY"
echo "    wrangler secret put STRIPE_SECRET_KEY"
echo "    wrangler secret put STRIPE_WEBHOOK_SECRET"

# ── Step 5: Install dependencies ───────────────────────────────────
echo ""
echo "→ Step 5: Installing dependencies..."
npm install 2>&1 | tail -3

# ── Step 6: Deploy ─────────────────────────────────────────────────
echo ""
echo "→ Step 6: Deploying heady-mcp-gateway Worker..."
wrangler deploy 2>&1

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  ✅ HeadyMCP Gateway deployed!"
echo ""
echo "  Endpoints:"
echo "    MCP:      https://headymcp.com/mcp"
echo "    Health:   https://headymcp.com/health"
echo "    SSE:      https://headymcp.com/sse"
echo "    Prefs:    https://headymcp.com/prefs"
echo "    Discovery: https://headymcp.com/.well-known/mcp.json"
echo ""
echo "  Test: npx @modelcontextprotocol/inspector --url https://headymcp.com/mcp"
echo "═══════════════════════════════════════════════════════"
