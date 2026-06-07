#!/bin/bash
# HEADY_BRAND:BEGIN
# ╔══════════════════════════════════════════════════════════════════╗
# ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
# ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
# ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
# ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
# ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
# ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
# ║                                                                  ║
# ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
# ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
# ║  FILE: configs/env-security-patch-2026-03-24.sh                                                    ║
# ║  LAYER: config                                                  ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END
# ═══════════════════════════════════════════════════════════════════════
# HEADY™ ENVIRONMENT SECURITY PATCH — Phase 0 Corrections
# Generated: 2026-03-24 by Claude (Phase 0 NOW execution)
# ═══════════════════════════════════════════════════════════════════════
# 
# INSTRUCTIONS:
# 1. Copy your production .env file to .env.backup
# 2. Apply these corrections to your .env
# 3. For items marked [ERIC], fill in the actual values from your provider dashboards
# 4. Deploy updated env to GCP Secret Manager
#
# ─── 0.3: REPLACE DEAD CLOUDFLARE TOKEN ──────────────────────────────
# OLD (DEAD): CLOUDFLARE_API_TOKEN=Y4S0dZWjdX8uITH3G2LrAlAQIzytGIwZrXCxfgD8
# NEW (from audit):
CLOUDFLARE_API_TOKEN=VGNo4jwin3V6eFO0HpGGYUyn2iWFM6JpkPfdIqUa
CF_API_TOKEN=VGNo4jwin3V6eFO0HpGGYUyn2iWFM6JpkPfdIqUa

# ─── 0.4: FIX NEON PASSWORD [ERIC — fill from Neon dashboard] ────────
# OLD: DATABASE_URL=postgresql://heady:PASSWORD@ep-cold-snow-aesmiwt9.us-east-2.aws.neon.tech/neondb?sslmode=require
# NEW:
# DATABASE_URL=postgresql://heady:YOUR_ACTUAL_NEON_PASSWORD@ep-cold-snow-aesmiwt9.us-east-2.aws.neon.tech/neondb?sslmode=require
# NEON_PASSWORD=YOUR_ACTUAL_NEON_PASSWORD

# ─── 0.5: PRODUCTION SECRETS (generated with openssl rand) ───────────
JWT_SECRET=gW4hiZRohuBFir/Bvem0uDOK9tjWaegXJe5w5ysQ5N445w/LiLbao7fD04lxcQt3
HEADY_JWT_SECRET=${JWT_SECRET}
HEADY_SESSION_SECRET=rEqYKSvsc0XNZobCOVbDBFsIbgAzePZVg3BIcF0WDoo9bdwMq8yQ+TduZ6wi/V+2
NEXTAUTH_SECRET=85CakGLhJypLViTLXs+Q4+E0RZe3sytd+BouHVIqixJ78SnEhek1rimc/+IpjMvR
ADMIN_TOKEN=9580c126a540e43959e6a4a5a144b429fe39ee0f23d4018c34f432174943fd8c
HEADY_ADMIN_TOKEN=${ADMIN_TOKEN}
MCP_BEARER_TOKEN=41b772d9b771cd7c849787da515b4f9a07246351d67b18ae
HEADY_SYNC_SHARED_TOKEN=165034c0d9933341fd58278d97c5eb2f19076d25b6eb0f87
WEBHOOK_SECRET=e468203e47f0db952aedbba7113b8e958dac62f9
HEALTH_INTERNAL_SECRET=9b743336edf369760d6c18f72e240b73

# ─── 0.6: REMOVE PLAINTEXT CREDS (migrate to GCP Secret Manager) ─────
# REMOVE these from .env entirely after storing in Secret Manager:
#   ADMIN_PASS=Thisismypass4this!        → gcloud secrets create heady-admin-pass
#   DRUPAL_DATABASE_PASSWORD=heady2026   → gcloud secrets create drupal-db-pass
#   NEXTAUTH_SECRET=...                  → gcloud secrets create nextauth-secret

# ─── 0.7: CORS FIX (no more wildcards) ──────────────────────────────
CORS_ORIGIN=https://headyme.com,https://headysystems.com,https://headyconnection.org,https://headybuddy.org,https://headymcp.com,https://headyio.com,https://headybot.com,https://headyapi.com,https://heady-ai.com
CORS_ORIGINS=${CORS_ORIGIN}
HEADY_CORS_ORIGIN=${CORS_ORIGIN}
HEADY_GUARD_CORS_ORIGIN=${CORS_ORIGIN}
HEADY_EVAL_CORS_ORIGINS=${CORS_ORIGIN}
ALLOWED_ORIGINS=${CORS_ORIGIN}

# ─── 0.8: FIX REDIS (localhost → Upstash) [ERIC — fill tokens] ──────
# OLD: REDIS_URL=redis://localhost:6379
# NEW:
# REDIS_URL=rediss://default:YOUR_UPSTASH_TOKEN@YOUR_INSTANCE.upstash.io:6379
# REDIS_HOST=YOUR_INSTANCE.upstash.io
# REDIS_PORT=6379
# REDIS_PASSWORD=YOUR_UPSTASH_TOKEN
# UPSTASH_REDIS_REST_URL=https://YOUR_INSTANCE.upstash.io
# UPSTASH_REDIS_REST_TOKEN=YOUR_UPSTASH_REST_TOKEN

# ─── 1.4: PORT STANDARDIZATION ──────────────────────────────────────
PORT=8080
HEADY_PORT=8080
# Dockerfile already updated to EXPOSE 8080
# Cloud Run overrides PORT=8080 at runtime
# heady-manager.js fallback=3300 is fine for local dev

# ─── BUDDY URL FIX (Phase 2.2) ──────────────────────────────────────
HEADY_BUDDY_URL=https://headybuddy.org
# (was pointing to .com which returns 503 — CF only has .org zone)

# ═══════════════════════════════════════════════════════════════════════
# ITEMS REQUIRING ERIC'S INPUT (pull from provider dashboards):
# ═══════════════════════════════════════════════════════════════════════
#
# [NEON]      NEON_PASSWORD, DATABASE_URL (with real password)
# [UPSTASH]   REDIS_URL, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
# [ANTHROPIC] ANTHROPIC_API_KEY
# [OPENAI]    OPENAI_API_KEY
# [GOOGLE]    GOOGLE_AI_API_KEY, GEMINI_API_KEY, GOOGLE_APPLICATION_CREDENTIALS
# [FIREBASE]  FIREBASE_API_KEY, FIREBASE_APP_ID
# [STRIPE]    STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
# [PINECONE]  PINECONE_API_KEY, PINECONE_INDEX, PINECONE_ENVIRONMENT
# [HF]        HF_TOKEN
# [CF]        CLOUDFLARE_ZONE_ID, tunnel IDs (9)
# [SENTRY]    Verify/refresh SENTRY_DSN
# ═══════════════════════════════════════════════════════════════════════
