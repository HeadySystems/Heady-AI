<!--
  © 2026 Heady Systems LLC.
  PROPRIETARY AND CONFIDENTIAL.
  Unauthorized copying, modification, or distribution is strictly prohibited.
-->
# 🔄 CascadeProjects Real-Time Sync Setup

## Overview
This implementation provides real-time synchronization for CascadeProjects with a sandbox-to-production pipeline, allowing you to use CascadeProjects as a sandbox before pushing to production.

## Components Created

### 1. Configuration File: `cascade-sync-config.yaml`
- Real-time bidirectional sync configuration
- Sandbox-to-production pipeline settings
- Git integration with automated commits
- Health checks and monitoring
- Security and performance optimizations

### 2. Sync Manager: `cascade-sync-manager.sh`
- Bash script for managing the sync service
- Real-time file watching using inotify
- Automated git operations
- Staging and production deployment
- Health checks and rollback capabilities

## Setup Instructions

### 1. Initialize the Sync Service
```bash
cd /home/headyme/CascadeProjects
./cascade-sync-manager.sh init
```

### 2. Start Real-Time Sync
```bash
./cascade-sync-manager.sh start
```

### 3. Check Status
```bash
./cascade-sync-manager.sh status
```

## Workflow

### Sandbox Environment (Develop Branch)
- **Real-time sync**: All file changes are automatically detected
- **Auto-commit**: Changes are committed with descriptive messages
- **Auto-push**: Pushed to `develop` branch automatically
- **Health checks**: Basic validation before staging

### Staging Environment (Staging Branch)
- **Auto-deploy**: Changes from develop are merged to staging
- **Health checks**: Comprehensive validation
- **Approval notification**: Notifies when ready for production

### Production Environment (Main Branch)
- **Manual approval**: Requires explicit approval before deployment
- **Health checks**: Full production validation
- **Rollback**: Automatic rollback if deployment fails

## Usage Examples

### Daily Development Workflow
1. Make changes in CascadeProjects (sandbox)
2. Changes are automatically synced to develop branch
3. When ready, deploy to staging:
   ```bash
   ./cascade-sync-manager.sh deploy-staging
   ```
4. Verify staging deployment
5. Deploy to production when ready:
   ```bash
   ./cascade-sync-manager.sh deploy-production
   ```

### Manual Operations
```bash
# Stop sync service
./cascade-sync-manager.sh stop

# Restart sync service
./cascade-sync-manager.sh stop
./cascade-sync-manager.sh start

# Run health checks
./cascade-sync-manager.sh health

# View sync status
./cascade-sync-manager.sh status
```

## Features

### Real-Time Monitoring
- File watching with 3-second intervals
- Change detection and batching
- Conflict resolution (sandbox wins)
- Desktop notifications for important events

### Git Integration
- Automated commits with descriptive messages
- Branch management (develop → staging → main)
- Pre-push hooks (lint, test, security scan)
- Rollback capabilities

### Security & Performance
- AES-256-GCM encryption
- SHA-256 integrity checks
- Delta sync for efficiency
- Compression and parallel uploads
- Retry logic with exponential backoff

### Health Checks
- Service status monitoring
- Configuration file validation
- Git repository integrity
- Deployment readiness validation

## Configuration

### Environment Variables
Set these in your shell or `.env` file:
```bash
export CASCADE_CLIENT_ID="your_client_id"
export CASCADE_CLIENT_SECRET="your_client_secret"
```

### Sync Intervals
- **Real-time sync**: 3 seconds
- **Health checks**: 20 seconds
- **Batch window**: 10 seconds

### File Exclusions
The following are excluded from sync:
- `*.tmp`, `.cache/`, `node_modules/`
- `*.pid`, `nohup.out`, `.venv/`
- Git files and build artifacts

## Troubleshooting

### Common Issues
1. **Missing dependencies**: Install `inotify-tools` for file watching
2. **Permission issues**: Ensure script is executable
3. **Git conflicts**: Resolve manually in CascadeProjects directory

### Logs
- Sync logs: `~/.headyme/logs/cascade-sync.log`
- Git history: View in CascadeProjects repository

### Stop Service
```bash
./cascade-sync-manager.sh stop
```

## Next Steps

1. Run the initialization command
2. Set up environment variables
3. Start the sync service
4. Test with a small change
5. Verify staging deployment
6. Test production deployment

This setup provides a robust sandbox-to-production pipeline with real-time synchronization, ensuring your changes are safely tested before reaching production.
