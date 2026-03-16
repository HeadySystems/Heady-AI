---
name: heady-checkpoint
description: Execute checkpoint protocol — 14-step state validation, sync, and commit cycle
---

# heady-checkpoint

Run the Heady checkpoint protocol — validates state integrity, syncs all registries, docs, and configs, then commits.

## What to do

1. Read `docs/CHECKPOINT_PROTOCOL.md` for the full 14-step protocol
2. Read `packages/hc-checkpoint/` for the checkpoint module
3. Execute the checkpoint sequence:
   - Validate project state integrity (no merge conflicts, clean working tree)
   - Run `node -c heady-manager.js` to verify syntax
   - Validate all YAML configs: `node -e "const yaml = require('js-yaml'); const fs = require('fs'); yaml.load(fs.readFileSync('configs/hcfullpipeline.yaml'))"`
   - Update `heady-registry.json` timestamps for modified components
   - Sync documentation (README, docs/, notebooks/)
   - Verify branding headers are present
   - Git commit with checkpoint message
4. Report checkpoint results including:
   - Files validated and any issues found
   - Registry updates applied
   - Git commit hash

## Key files

- `docs/CHECKPOINT_PROTOCOL.md` — Full 14-step protocol definition
- `packages/hc-checkpoint/` — Checkpoint module
- `heady-registry.json` — Component registry (update timestamps)
- `configs/skills-registry.yaml` — Skills: `checkpoint_sync`
- `scripts/validate-branding.js` — Branding validation script
