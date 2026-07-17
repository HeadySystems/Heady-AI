#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║  HEADY™ Git Hooks Setup Script                                   ║
# ║  Installs ARBITER fail-closed security gates natively            ║
# ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
# ╚══════════════════════════════════════════════════════════════════╝

echo "🦁 HEADY ARBITER: Setting up native Git Hooks..."

# Ensure the .git/hooks directory exists
mkdir -p .git/hooks

# Make the hooks executable
chmod +x .git/hooks/pre-commit
chmod +x .git/hooks/pre-push

# Inform the user
echo "✅ ARBITER: Native secret-scanning hooks have been successfully installed and activated."
echo "Your commits and pushes will now be automatically scanned for secrets before execution."
