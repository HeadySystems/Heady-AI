#!/bin/bash
# Enterprise Build Script for Heady Desktop Suite

set -e

echo "=========================================="
echo "    Building Heady Distribution Pack    "
echo "=========================================="

mkdir -p dist

echo "[1/3] Building HeadyWeb executable..."
npm run build:web

echo "[2/3] Building HeadyBuddy executable..."
npm run build:buddy

echo "[3/3] Building HeadyAI-IDE executable..."
npm run build:ide

echo "=========================================="
echo "  Packaging Heady-Distribution-Pack.zip "
echo "=========================================="

cd dist
zip -r ../Heady-Distribution-Pack.zip *
cd ..

echo "✅ Distribution pack built successfully at ./Heady-Distribution-Pack.zip"
