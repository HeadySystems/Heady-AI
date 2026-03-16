---
name: heady-config
description: Read, validate, and manage all 99+ Heady configuration files (YAML/JSON)
---

# heady-config

Manage the Heady configuration system — 99+ YAML/JSON files in `configs/`.

## What to do

1. Use MCP tool `heady_list_configs` to enumerate all config files
2. Use MCP tool `heady_read_config` to read specific configs by filename
3. Use MCP tool `heady_config_validate` to cross-validate configs (check service references, pipeline stages, agent definitions)
4. Key config categories:
   - **Pipeline**: `hcfullpipeline.yaml`, `hcfullpipeline-tasks.json`, `pipeline-gates.yaml`
   - **Services**: `service-catalog.yaml`, `app-readiness.yaml`
   - **Agents**: `packages/agents/catalog.yaml`, `configs/agent-profiles/`
   - **Skills**: `configs/skills-registry.yaml`
   - **Security**: `governance-policies.yaml`, `resource-policies.yaml`
   - **Branding**: `configs/branding/branding-standards.yaml`
   - **Infrastructure**: `auto-deploy.yaml`, `render.yaml`
   - **AI/ML**: `configs/ai/`, `configs/liquid-os/`
5. For drift detection, compare config state against `heady-registry.json` timestamps

## Config subdirectories

- `configs/agent-profiles/` — Brain profiles and agent config
- `configs/ai/` — AI model configurations
- `configs/branding/` — Brand standards and assets
- `configs/liquid-os/` — Liquid OS / Bio-Computing configs
- `configs/pki/` — PKI and certificate configs
- `configs/security/` — Security policies

## Key files

- `configs/` — All 99+ config files
- `heady-registry.json` — Component registry with timestamps
- `mcp-servers/heady-mcp-server.js` — MCP tools: `heady_list_configs`, `heady_read_config`, `heady_config_validate`
