#!/bin/bash
# Heady Friends & Family Distribution Pack Builder

set -e

echo "================================================="
echo "   Building Heady Family & Friends Distribution  "
echo "================================================="

# Go to the suite directory
cd "$(dirname "$0")"

# Ensure dependencies are installed
echo "[0/3] Installing dependencies..."
npm install

echo "[1/3] Building HeadyWeb executables (Windows/Mac/Linux)..."
npm run build:web

echo "[2/3] Building HeadyBuddy executables (Windows/Mac/Linux)..."
npm run build:buddy

echo "[3/3] Building HeadyAI-IDE executables (Windows/Mac/Linux)..."
npm run build:ide

echo "================================================="
echo "  Packaging Heady-Friends-Family-Pack.zip        "
echo "================================================="

# Create a clean folder for the family pack
rm -rf dist/Heady-Friends-Family-Pack
mkdir -p dist/Heady-Friends-Family-Pack

# Copy only the compiled installers
cp dist/HeadyWeb/*.exe dist/HeadyWeb/*.dmg dist/HeadyWeb/*.AppImage dist/Heady-Friends-Family-Pack/ 2>/dev/null || true
cp dist/HeadyBuddy/*.exe dist/HeadyBuddy/*.dmg dist/HeadyBuddy/*.AppImage dist/Heady-Friends-Family-Pack/ 2>/dev/null || true
cp dist/HeadyAI-IDE/*.exe dist/HeadyAI-IDE/*.dmg dist/HeadyAI-IDE/*.AppImage dist/Heady-Friends-Family-Pack/ 2>/dev/null || true

# Zip it up from the dist folder
cd dist
zip -r ../Heady-Friends-Family-Pack.zip Heady-Friends-Family-Pack
cd ..

echo "✅ Family & Friends Distribution pack built successfully at ./Heady-Friends-Family-Pack.zip!"
