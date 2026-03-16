#!/usr/bin/env bash
# services/heady-inference/colab-setup.sh
# Colab Pro+ deployment script for vLLM inference
#
# HEADY_BRAND:BEGIN
# © 2026 HeadySystems Inc. — Colab Pro+ vLLM Deployment
# HEADY_BRAND:END
#
# Usage: Run each cell in a Colab Pro+ notebook (A100/H100 runtime)
#
# Cell 1: Install dependencies
# Cell 2: Start vLLM server
# Cell 3: Expose via Cloudflare tunnel
# Cell 4: Verify health

set -euo pipefail

echo "═══════════════════════════════════════════════"
echo "  HEADY INFERENCE — vLLM Colab Pro+ Setup"
echo "═══════════════════════════════════════════════"

# ─── Cell 1: Install ───
echo "[1/4] Installing vLLM + cloudflared..."
pip install -q vllm
pip install -q cloudflared

# ─── Cell 2: Start vLLM Server ───
echo "[2/4] Starting vLLM server..."
MODEL="${VLLM_MODEL:-meta-llama/Llama-3.1-8B-Instruct}"
PORT="${VLLM_PORT:-8000}"

python -m vllm.entrypoints.openai.api_server \
  --model "$MODEL" \
  --quantization awq \
  --enable-prefix-caching \
  --max-num-seqs 128 \
  --port "$PORT" \
  --host 0.0.0.0 &

VLLM_PID=$!
echo "[2/4] vLLM PID: $VLLM_PID"

# Wait for server to be ready
echo "[2/4] Waiting for vLLM to initialize..."
for i in $(seq 1 60); do
  if curl -s "http://localhost:$PORT/health" > /dev/null 2>&1; then
    echo "[2/4] vLLM ready after ${i}s"
    break
  fi
  sleep 1
done

# ─── Cell 3: Cloudflare Tunnel ───
echo "[3/4] Starting Cloudflare tunnel..."
cloudflared tunnel --url "http://localhost:$PORT" &
CF_PID=$!
echo "[3/4] Cloudflare tunnel PID: $CF_PID"
echo "[3/4] Copy the tunnel URL and set as HEADY_LLM_ENDPOINT"

# ─── Cell 4: Verify ───
echo "[4/4] Verifying health..."
sleep 5
curl -s "http://localhost:$PORT/health" | python -m json.tool 2>/dev/null || echo "Health check pending..."

echo ""
echo "═══════════════════════════════════════════════"
echo "  HEADY INFERENCE READY"
echo "  Model: $MODEL"
echo "  Port: $PORT"
echo "  vLLM PID: $VLLM_PID"
echo "  Tunnel PID: $CF_PID"
echo "═══════════════════════════════════════════════"
echo ""
echo "Set this in your environment:"
echo "  HEADY_LLM_ENDPOINT=https://<tunnel-url>"
