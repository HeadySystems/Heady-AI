#!/bin/bash
# Heady All — Launch entire Heady platform
echo "=========================================="
echo "  HEADY SYSTEMS — Full Platform Launch"
echo "=========================================="
echo ""

BIN_DIR="$(dirname "$0")"

echo "[1/7] Starting Heady Manager (API backend :3300)..."
bash "$BIN_DIR/heady-manager.sh" &
sleep 2

echo "[2/7] Starting HeadyWeb (Browser :4100)..."
bash "$BIN_DIR/heady-web.sh" &
sleep 1

echo "[3/7] Starting HeadyBuddy (AI Assistant :4201)..."
bash "$BIN_DIR/heady-buddy.sh" &
sleep 1

echo "[4/7] Starting HeadyAI-IDE (Dev Environment :4301)..."
bash "$BIN_DIR/heady-ai-ide.sh" &
sleep 1

echo "[5/7] Starting Heady Admin (Admin Panel :4401)..."
bash "$BIN_DIR/heady-admin.sh" &
sleep 1

echo "[6/7] Starting HeadyIO (Portal :4500)..."
bash "$BIN_DIR/heady-io.sh" &
sleep 1

echo "[7/7] Starting HeadyConnection (Portal :4600)..."
bash "$BIN_DIR/heady-connection.sh" &
sleep 3

echo ""
echo "=========================================="
echo "  All Heady Apps Running!"
echo "=========================================="
echo ""
echo "  Heady Manager    → http://localhost:3300"
echo "  HeadyWeb          → http://localhost:4100"
echo "  HeadyBuddy        → http://localhost:4201"
echo "  HeadyAI-IDE       → http://localhost:4301"
echo "  Heady Admin       → http://localhost:4401"
echo "  HeadyIO           → http://localhost:4500"
echo "  HeadyConnection   → http://localhost:4600"
echo ""
