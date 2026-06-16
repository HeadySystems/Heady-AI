#!/bin/bash

# Scaffolding Script for the Heady Latent OS Monorepo Skeleton

echo "Scaffolding Heady Latent OS Skeleton..."

# Create core directories
mkdir -p apps/heady-manager
mkdir -p packages/{phi-math,csl-engine,contracts,db,security-mesh,logger}

# Helper function to create package.json
create_pkg_json() {
  local dir=$1
  local name=$2
  cat <<EOF > "$dir/package.json"
{
  "name": "$name",
  "version": "2.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "echo 'Nothing to build in $name'",
    "test": "echo 'No tests in $name'"
  }
}
EOF
}

# Scaffold Packages (Phase 1)
create_pkg_json "packages/phi-math" "@heady/phi-math"
create_pkg_json "packages/csl-engine" "@heady/csl-engine"
create_pkg_json "packages/contracts" "@heady/contracts"
create_pkg_json "packages/db" "@heady/db"
create_pkg_json "packages/security-mesh" "@heady/security-mesh"
create_pkg_json "packages/logger" "@heady/logger"

# Scaffold Apps (Phase 3)
create_pkg_json "apps/heady-manager" "heady-manager"

# Create Phase 2 Data Structure Skeleton (Stub directories)
mkdir -p .data/{task-ledger,vector-memory,embedding-router}

echo "Scaffolding complete! Run 'pnpm install' to link workspaces."
