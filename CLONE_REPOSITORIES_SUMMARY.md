# HeadyStack Clone Repositories - Summary

## Created Repositories

All three clone repositories have been successfully created with timestamp `20260217-021720`:

### 1. HeadyStack-Hybrid-Workstation-20260217-021720
- **Type**: hybrid
- **Profile**: hybrid.yml
- **Description**: Local-first with cloud fallback
- **Model Policy**: LOCAL_FIRST with cloud fallback enabled
- **Location**: `c:\Users\erich\HeadyStack-Hybrid-Workstation-20260217-021720`

### 2. HeadyStack-Offline-Secure-20260217-021720
- **Type**: offline
- **Profile**: local-offline.yml
- **Description**: Air-gapped, maximum privacy
- **Model Policy**: LOCAL_ONLY, no cloud connectivity
- **Location**: `c:\Users\erich\HeadyStack-Offline-Secure-20260217-021720`

### 3. HeadyStack-Cloud-Hub-20260217-021720
- **Type**: cloud
- **Profile**: cloud-saas.yml
- **Description**: Cloud-optimized SaaS deployment
- **Model Policy**: CLOUD_ONLY, minimal local footprint
- **Location**: `c:\Users\erich\HeadyStack-Cloud-Hub-20260217-021720`

## Repository Structure

Each clone contains the full canonical mono-repo structure:
- `apps/` - Application frontends
- `services/` - Backend services
- `infra/docker/` - Docker configurations
- `packages/` - Shared libraries
- `distribution/` - Distribution packs
- `docs/` - Documentation
- `scripts/maintenance/` - Verification scripts

## Usage Instructions

### Starting a Repository

```bash
# Navigate to any clone
cd c:\Users\erich\HeadyStack-Hybrid-Workstation-20260217-021720

# Start with the appropriate profile
docker compose -f infra/docker/docker-compose.base.yml -f infra/docker/profiles/hybrid.yml up

# For offline repository
docker compose -f infra/docker/docker-compose.base.yml -f infra/docker/profiles/local-offline.yml up

# For cloud repository
docker compose -f infra/docker/docker-compose.base.yml -f infra/docker/profiles/cloud-saas.yml up
```

### Service Endpoints

Once running:
- **API Gateway**: http://localhost:3300
- **Web UI**: http://localhost:3000
- **Orchestrator**: http://localhost:3301
- **Model Router**: http://localhost:3400
- **Ollama**: http://localhost:11434

### Environment Configuration

Each clone includes `.env.example` with appropriate defaults:
- Hybrid: `MODEL_POLICY=LOCAL_FIRST`, `CLOUD_FALLBACK=true`
- Offline: `MODEL_POLICY=LOCAL_ONLY`, `CLOUD_FALLBACK=false`
- Cloud: `MODEL_POLICY=CLOUD_ONLY`, `CLOUD_FALLBACK=true`

## Verification

Run the verification script to check all clones:
```bash
pwsh -File c:\Users\erich\Heady\scripts\verify-clones.ps1
```

## Maintenance Scripts

Each clone includes maintenance scripts in `scripts/maintenance/`:
- `check-structure-identical.ps1` - Verifies directory structure
- `check-docker-profiles.ps1` - Validates all 10 Docker profiles
- `check-model-router-policy.ps1` - Ensures policy matches repo type

## Next Steps

1. **Test Each Profile**: Start each repository with its profile to verify functionality
2. **Customize Configurations**: Adjust `.env` files as needed for your environment
3. **Add Git Remotes**: Initialize git repos and add remotes for collaboration
4. **Deploy**: Use the appropriate profile for your target environment

## Notes

- All repositories are self-contained and can operate independently
- Docker profiles ensure consistent behavior across deployments
- The canonical repository at `c:\Users\erich\Heady` remains the source of truth
- Clone repositories track their source and canonical tag in `repo-type.yaml`
