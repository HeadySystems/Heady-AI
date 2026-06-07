<!-- HEADY_BRAND:BEGIN
<!-- ╔══════════════════════════════════════════════════════════════════╗
<!-- ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
<!-- ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
<!-- ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
<!-- ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
<!-- ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
<!-- ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
<!-- ║                                                                  ║
<!-- ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
<!-- ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
<!-- ║  FILE: docs/Heady-Commands-Guide.md                                                    ║
<!-- ║  LAYER: docs                                                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
# Heady Systems - Comprehensive Commands Guide

## 🎯 Executive Summary

This guide provides a complete overview of all available commands in the Heady Systems ecosystem, organized by function and usage patterns.

---

## 📋 Table of Contents

1. [Core System Commands](#core-system-commands)
2. [HC (Heady Command) System](#hc-heady-command-system)
3. [Auto-Deployment Commands](#auto-deployment-commands)
4. [Development & Build Commands](#development--build-commands)
5. [Service Management Commands](#service-management-commands)
6. [Testing & Validation Commands](#testing--validation-commands)
7. [Resource Management Commands](#resource-management-commands)
8. [Specialized Commands](#specialized-commands)
9. [Emergency & Recovery Commands](#emergency--recovery-commands)
10. [Quick Reference Cheat Sheet](#quick-reference-cheat-sheet)

---

## 🚀 Core System Commands

### Package Manager Scripts (from package.json)

```bash
# Start Services
npm start                    # Start heady-manager.js
npm run start:mcp           # Start MCP backend server
npm run dev                 # Development with nodemon

# Build Commands
npm run build               # Build frontend
npm run build-all           # Build all components (desktop + mobile)
npm run build:desktop       # Build desktop app
npm run build:mobile        # Build mobile app

# Development Tools
npm run frontend            # Start frontend dev server
npm run backend             # Start backend services
npm run cli                 # Run Heady CLI

# Testing & Quality
npm test                    # Run tests
npm run lint                # Run ESLint
npm run lint:fix            # Fix ESLint issues

# Pipeline & Automation
npm run pipeline            # Run HC pipeline
npm run pipeline:config     # Show pipeline configuration

# Synchronization
npm run sync                # Run Heady sync script

# Branding & Validation
npm run brand:check         # Check brand headers
npm run brand:fix           # Fix brand headers
npm run test:domains        # Test domain connectivity
npm run test:branding       # Validate branding

# Deployment
npm run deploy              # Standard deployment
npm run deploy:auto         # Auto-deployment
```

---

## 🎮 HC (Heady Command) System

The HC system provides rapid execution and learning capabilities.

### Basic HC Usage

```bash
# HC RX (Rapid Execute) - Learn & Fix Patterns
node scripts/hc.js --rx "error message or request"
node scripts/hc.js --rx help                    # Show help
node scripts/hc.js --rx list                     # List learned patterns
node scripts/hc.js --rx clear                    # Clear history

# Add Custom RX Patterns
node scripts/hc.js --rx add "pattern to match" "command to run"

# Examples of RX Commands
node scripts/hc.js --rx "port 3300 already in use"
node scripts/hc.js --rx "websites aren't fully functional"
node scripts/hc.js --rx "HeadyAI-IDE doesn't work"
node scripts/hc.js --rx "never localhost or similar type of reference"
```

### Available RX Patterns (Pre-configured)

1. **"finish incomplete tasks and when ready auto-deploy"**
   - Fix: `node scripts/auto-deploy.js`

2. **"HeadyAI-IDE doesn't work"**
   - Fix: `node scripts/fix-headyai-ide.js`

3. **"never localhost or similar type of reference, only custom branded domains, no .onrender.com"**
   - Fix: `powershell -ExecutionPolicy Bypass -File scripts/remove-localhost-references.ps1`

---

## 🔄 Auto-Deployment Commands

### Primary Auto-Deploy

```bash
# Full Auto-Deploy Pipeline
node scripts/auto-deploy.js                    # Complete deployment pipeline
node scripts/deploy.js                         # Standard deployment
node scripts/deploy.js --auto                  # Auto-deployment

# HC Auto-Deploy Triggers
node scripts/hc.js --rx "auto-deploy"
node scripts/hc.js --rx "finish incomplete tasks and when ready auto-deploy"
```

### Deployment Workflow Scripts

```bash
# HCFP (Heady Cloud Full Pipeline)
.\scripts\hcfp-build.ps1                       # Full pipeline build
.\scripts\hcfp-clean-build.ps1                 # Clean build & deployment
.\scripts\hcfp-error-recovery.ps1             # Error recovery protocol

# Auto-Build System
.\scripts\hcautobuild.ps1                      # Automated checkpoint system
.\scripts\hcautoflow.ps1                       # Auto-flow execution
```

### Cloud-Specific Deployments

```bash
# HeadyMe Cloud Operations
node scripts/hc.js --rx "HeadyMe clouds only"

# Multi-Cloud Sync
.\scripts\Heady-Sync.ps1                       # Multi-remote git sync
.\scripts\nexus_deploy.ps1                     # Push to all remotes
```

---

## 🛠️ Development & Build Commands

### Frontend Development

```bash
# React Frontend
cd frontend && npm start                       # Start React dev server
cd frontend && npm run build                   # Build for production
npm run frontend                               # Start frontend from root

# HeadyBuddy Development
cd headybuddy && npm start                    # Start HeadyBuddy
cd headybuddy && npm run build                 # Build HeadyBuddy

# HeadyWeb Development
cd headybrowser-desktop && npm run dev         # Desktop browser dev
cd apps/mobile/HeadyWeb && npm start          # Mobile browser dev
```

### Backend Development

```bash
# Node.js Backend
npm run start:mcp                              # Start MCP server
npm run backend                                # Start backend services

# Python Worker
cd src && python worker.py                    # Python render worker
```

### Desktop Applications

```bash
# HeadyAI-IDE
cd HeadyAI-IDE && npm start                    # Start IDE
cd HeadyAI-IDE && npm run build               # Build IDE

# Electron Apps
npm run build:desktop                          # Build desktop applications
```

---

## 🎛️ Service Management Commands

### Starting Services

```bash
# Main Services
npm start                                      # Start heady-manager (port 3301)
npm run start:mcp                              # Start MCP backend

# Development Servers
npm run frontend                               # Frontend dev server (port 3000)
npm run backend                                # Backend services

# All Services
.\scripts\start-all-services.ps1              # Start all Heady services
```

### Service Health & Monitoring

```bash
# Health Checks
curl http://localhost:3301/health              # Local health check
curl https://headysystems.com/api/health       # Cloud health check

# Service Status
.\scripts\health-check.ps1                     # System health monitoring
.\scripts\heady-connectivity-enforcer.ps1     # Connectivity monitoring
```

### Port Management

```bash
# Kill Processes on Ports
.\scripts\kill-port.ps1 3300                  # Kill process on port 3300
.\scripts\kill-port.ps1 3000                  # Kill process on port 3000
npm test                                       # Runs kill-port.ps1 + tests
```

---

## 🧪 Testing & Validation Commands

### Code Quality

```bash
# Linting
npm run lint                                   # Run ESLint
npm run lint:fix                               # Fix ESLint issues automatically

# Type Checking (if using TypeScript)
npx tsc --noEmit                              # Type check without compilation
```

### Branding Validation

```bash
# Brand Headers
npm run brand:check                           # Check brand header compliance
npm run brand:fix                             # Fix brand headers automatically
npm run test:branding                         # Validate branding consistency
```

### Domain & Connectivity Testing

```bash
# Domain Connectivity
npm run test:domains                          # Test all domain connections
.\scripts\domain-connectivity-test.js         # Manual domain testing

# Integration Tests
npm test                                       # Run full test suite
.\scripts\integration-tests.ps1               # Run integration tests
```

---

## 📊 Resource Management Commands

### Memory & Performance

```bash
# Memory Preloading
.\scripts\memory-preload.ps1                   # Preload project context
.\scripts\memory-preload.ps1 -Mode preload     # Preload mode
.\scripts\memory-preload.ps1 -Mode verify      # Verify memory state
.\scripts\memory-preload.ps1 -Mode reset       # Reset memory caches
```

### Resource Allocation

```bash
# Resource Control (via API)
curl -X POST https://headysystems.com/api/resources/allocation \
  -H "Content-Type: application/json" \
  -d '{"action": "suspend", "process": "auto-training"}'

# Monte Carlo Optimization
.\scripts\monte-carlo-optimization.ps1         # Run optimization
node scripts/hc.js --rx "run monte carlo optimization"
```

### System Resources

```bash
# Resource Monitoring
.\scripts\resource-monitor.ps1                # Monitor system resources
.\scripts\performance-check.ps1               # Performance validation
```

---

## 🎯 Specialized Commands

### Training & AI

```bash
# Model Training
.\scripts\train-model.ps1                     # Train AI model
.\scripts\train-model.ps1 -auto               # Auto training
.\scripts\train-model.ps1 -nonInteractive     # Non-interactive mode

# HC Training Command
node scripts/hc.js train                       # Trigger model training (auto + non-interactive)
node scripts/hc.js --rx --train               # Alternative training trigger

# Advanced Training Scripts
.\scripts\train-model-simple.ps1              # Simplified training script
.\scripts\train-until-ready.ps1               # Train until system ready
.\scripts\train-until-100.ps1                 # Train until 100% accuracy
```

#### HC --train Command Details

The `hc --train` command triggers Heady AI model training to improve system performance, pattern recognition, and autonomous capabilities.

**What it does:**
- Initiates training on HeadyBrain cloud service
- Sends training requests with configurable parameters
- Supports both automatic and manual training modes
- Provides fallback endpoints for reliability
- Returns job IDs for tracking training progress

**Command Variations:**
```bash
# Basic training (auto + non-interactive)
node scripts/hc.js train

# Direct script execution with options
.\scripts\train-model-simple.ps1 -auto -nonInteractive
.\scripts\train-model-simple.ps1 -auto          # Auto mode only
.\scripts\train-model-simple.ps1 -nonInteractive # Non-interactive mode only
.\scripts\train-model-simple.ps1               # Interactive mode
```

**Training Parameters:**
- **Auto Mode**: `-auto` flag enables fully automated training
- **Non-Interactive**: `-nonInteractive` flag runs without user prompts
- **Manual Mode**: No flags runs in interactive mode with confirmations

**Endpoints Used:**
1. **Primary**: `https://headysystems.com/api/v1/train`
2. **Fallback**: `https://heady-manager-headysystems.headysystems.com/api/v1/train`

**Common Use Cases:**

```bash
# 1. Daily Performance Improvement
node scripts/hc.js train
# Optimizes system performance and pattern recognition

# 2. After Major Changes
npm run deploy:auto && node scripts/hc.js train
# Train system after deploying new features

# 3. Problem Resolution
node scripts/hc.js --rx "system performance degraded" && node scripts/hc.js train
# Fix issues and retrain for better recognition

# 4. Scheduled Optimization
# Add to cron/task scheduler for daily training
node scripts/hc.js train

# 5. Before Critical Operations
node scripts/hc.js train && node scripts/hc.js --rx "auto-deploy"
# Train system then deploy for optimal performance
```

**Optimal Usage Patterns:**

```bash
# Development Workflow
1. Make code changes
2. npm run lint:fix
3. node scripts/hc.js train
4. npm run test
5. node scripts/hc.js --rx "auto-deploy"

# Production Maintenance
1. node scripts/hc.js train
2. Monitor training results
3. Verify system performance
4. Deploy if improvements confirmed

# Performance Optimization
1. .\scripts\train-until-ready.ps1
2. .\scripts\train-until-100.ps1
3. Verify 100% training completion
4. Deploy optimized model
```

**Training Response:**
```json
{
  "jobId": "train_20260214_123456",
  "status": "started",
  "mode": "auto",
  "estimatedDuration": "5-10 minutes"
}
```

**Best Practices:**
- Use `-auto -nonInteractive` for automated workflows
- Train after major code changes for better pattern recognition
- Monitor training progress via job IDs
- Combine with deployment for optimized performance
- Schedule regular training for continuous improvement

### Database Operations

```bash
# Database Setup
.\scripts\setup-database.ps1                  # Initialize database
.\scripts\migrate-database.ps1                # Run migrations

# PostgreSQL Operations
docker-compose up -d db                       # Start database container
```

### Docker & Container Management

```bash
# Docker Compose
docker-compose up -d                          # Start all services
docker-compose down                           # Stop all services
docker-compose restart                        # Restart services

# Specific Services
docker-compose up -d heady-manager           # Start manager only
docker-compose up -d python-worker           # Start Python worker
```

---

## 🚨 Emergency & Recovery Commands

### System Recovery

```bash
# Error Recovery
.\scripts\hcfp-error-recovery.ps1            # Full error recovery protocol
.\scripts\emergency-recovery.ps1             # Emergency procedures

# Service Recovery
.\scripts\heady-service-recovery.ps1         # Automatic service recovery
.\scripts\heady-service-failover.ps1          # Service failover
```

### Backup & Restore

```bash
# Backup Operations
.\scripts\backup-system.ps1                   # Full system backup
.\scripts\backup-configs.ps1                  # Configuration backup

# Restore Operations
.\scripts\restore-system.ps1                   # System restore
.\scripts\restore-configs.ps1                 # Configuration restore
```

### Clean Up Operations

```bash
# System Cleanup
.\scripts\cleanup-temp-files.ps1              # Clean temporary files
.\scripts\cleanup-node-modules.ps1            # Clean node_modules
.\scripts\cleanup-docker.ps1                  # Clean Docker resources

# Git Cleanup
git gc --aggressive                           # Aggressive garbage collection
git clean -fd                                  # Clean untracked files
```

---

## 📋 Quick Reference Cheat Sheet

### Most Common Commands

```bash
# Daily Development
npm start                                      # Start main service
npm run frontend                               # Start frontend
npm run lint:fix                               # Fix code issues

# AI Training & Optimization
node scripts/hc.js train                       # Train AI model (daily optimization)
.\scripts\train-model-simple.ps1 -auto         # Auto training mode

# Deployment
node scripts/hc.js --rx "auto-deploy"         # Quick deploy
npm run deploy:auto                            # Auto deployment

# Problem Solving
node scripts/hc.js --rx "describe problem"    # AI-assisted fix
.\scripts\kill-port.ps1 3300                  # Clear port conflicts

# Health & Status
curl https://headysystems.com/api/health       # Check cloud status
npm run test:domains                          # Test connectivity
```

### Emergency Commands

```bash
# Service Down
.\scripts\heady-service-recovery.ps1         # Recover services
npm run restart-all                           # Restart everything

# Deployment Issues
.\scripts\hcfp-error-recovery.ps1             # Fix deployment errors
node scripts/hc.js --rx "deployment failed"    # AI fix deployment

# Performance Issues
.\scripts\memory-preload.ps1 -Mode reset       # Reset memory
.\scripts\cleanup-temp-files.ps1              # Clean up resources
```

### Development Workflow

```bash
# 1. Start Development
npm start                                      # Start backend
npm run frontend                               # Start frontend

# 2. Make Changes
# ... edit files ...

# 3. Quality Check
npm run lint:fix                               # Fix linting
npm run test:branding                         # Check branding

# 4. AI Training (Optimize Performance)
node scripts/hc.js train                       # Train AI model

# 5. Deploy
node scripts/hc.js --rx "auto-deploy"         # Deploy changes
```

---

## 🔧 Configuration & Customization

### Environment Variables

```bash
# Set Environment
export NODE_ENV=development                   # Development mode
export NODE_ENV=production                    # Production mode

# API Configuration
export HEADY_API_KEY="your-api-key"          # API authentication
export DATABASE_URL="your-db-url"            # Database connection
```

### Custom Script Creation

```bash
# Create new script in /scripts/
# Make it executable
# Add to package.json if needed
# Commit to repository
```

---

## 📞 Getting Help

### Command Help

```bash
# Package Scripts
npm run                                        # List all npm scripts
npm help <command>                            # Get help for npm command

# HC System
node scripts/hc.js --rx help                   # HC system help
node scripts/hc.js --rx list                   # Show learned patterns

# PowerShell Scripts
Get-Help .\script-name.ps1                    # PowerShell help
```

### Troubleshooting

```bash
# Check Logs
tail -f logs/heady-manager.log                # Monitor logs
Get-EventLog -LogName Application            # Windows event logs

# Debug Mode
DEBUG=* npm start                             # Debug mode
npm run dev                                   # Development mode with debugging
```

---

## 🎓 Best Practices

### Daily Workflow

1. **Start**: `npm start && npm run frontend`
2. **Develop**: Make changes with live reload
3. **Validate**: `npm run lint:fix && npm run test:branding`
4. **Train**: `node scripts/hc.js train` (AI optimization)
5. **Deploy**: `node scripts/hc.js --rx "auto-deploy"`
6. **Monitor**: `curl https://headysystems.com/api/health`

### Before Committing

```bash
npm run lint:fix                               # Fix code style
npm run brand:fix                             # Fix brand headers
npm run test:domains                          # Test connectivity
git add . && git commit -m "descriptive message"
```

### Problem Resolution

1. **Try HC RX**: `node scripts/hc.js --rx "describe issue"`
2. **Check Health**: `curl https://headysystems.com/api/health`
3. **Clear Conflicts**: `.\scripts\kill-port.ps1 3300`
4. **Recover**: `.\scripts\heady-service-recovery.ps1`
5. **Deploy Fix**: `node scripts/hc.js --rx "auto-deploy"`

---

## 📚 Additional Resources

### Documentation Files

- `docs/` - Comprehensive documentation
- `configs/` - Configuration files
- `scripts/README.md` - Script documentation
- `.windsurf/workflows/` - Workflow documentation

### Configuration Files

- `package.json` - NPM scripts and dependencies
- `render.yml` - Cloud deployment configuration
- `docker-compose.yml` - Docker service configuration
- `.windsurfrules` - Windsurf IDE rules

---

## 🎯 Conclusion

This guide provides a comprehensive overview of all available commands in the Heady Systems ecosystem. The HC (Heady Command) system with RX patterns offers intelligent, learning-based automation for common tasks and issues.

For the most up-to-date information, always check:
- `npm run` for latest package scripts
- `node scripts/hc.js --rx list` for available RX patterns
- `docs/` directory for detailed documentation

**Remember**: The HC system learns from your usage patterns and can automate repetitive tasks. Use `node scripts/hc.js --rx "your request"` for intelligent assistance with any Heady Systems task.
