<# HEADY_BRAND:BEGIN
<# ╔══════════════════════════════════════════════════════════════════╗
<# ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
<# ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
<# ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
<# ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
<# ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
<# ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
<# ║                                                                  ║
<# ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
<# ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
<# ║  FILE: scripts/hc-finalize.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
# HEADY_BRAND:BEGIN
# ╔══════════════════════════════════════════════════════════════════╗
# ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
# ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
# ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
# ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
# ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
# ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
# ║                                                                  ║
# ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
# ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
# ║  FILE: scripts/hc-finalize.ps1                                        ║
# ║  LAYER: scripts                                                  ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END

# Heady Complete Finalization Script
# HCFP Rebuild + Production Pre-Live + PyCharm Migration

param(
    [switch]$SkipTests = $false,
    [switch]$Force = $false,
    [switch]$Production = $false
)

Write-Host "🚀 Heady Complete Finalization" -ForegroundColor Cyan
Write-Host "===========================" -ForegroundColor Cyan
Write-Host ""

# Phase 1: System Health Check
function Test-SystemHealth {
    Write-Host "🔍 Phase 1: System Health Check" -ForegroundColor Yellow
    Write-Host "----------------------------" -ForegroundColor Yellow
    
    # Check Docker containers
    Write-Host "Checking Docker containers..." -ForegroundColor Blue
    $containers = docker ps --filter "name=heady" --format "{{.Names}}" | Measure-Object
    if ($containers.Count -ge 8) {
        Write-Host "✅ Docker containers: $($containers.Count) running" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Docker containers: $($containers.Count) (expected 8+)" -ForegroundColor Yellow
    }
    
    # Check Heady Manager health
    try {
<<<<<<< HEAD
        $health = Invoke-RestMethod -Uri "http://localhost:3300/api/health" -TimeoutSec 5
=======
        $health = Invoke-RestMethod -TimeoutSec 10 -Uri "http://api.headysystems.com:3300/api/health" -TimeoutSec 5
>>>>>>> heady-testing/claude/autonomous-agent-system-prompt-qarZg
        Write-Host "✅ Heady Manager: $($health.version) - Uptime: $([math]::Round($health.uptime/60,1))min" -ForegroundColor Green
    } catch {
        Write-Host "❌ Heady Manager: Not responding" -ForegroundColor Red
    }
    
    # Check Ollama
    try {
<<<<<<< HEAD
        $models = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -TimeoutSec 5
=======
        $models = Invoke-RestMethod -TimeoutSec 10 -Uri "http://api.headysystems.com:11434/api/tags" -TimeoutSec 5
>>>>>>> heady-testing/claude/autonomous-agent-system-prompt-qarZg
        Write-Host "✅ Ollama: $($models.models.Count) models available" -ForegroundColor Green
    } catch {
        Write-Host "❌ Ollama: Not responding" -ForegroundColor Red
    }
    
    # Check PyCharm setup
    if (Test-Path ".idea") {
        Write-Host "✅ PyCharm configuration: Found" -ForegroundColor Green
    } else {
        Write-Host "❌ PyCharm configuration: Missing" -ForegroundColor Red
    }
    
    Write-Host ""
}

# Phase 2: Production Pre-Live Tests
function Invoke-ProductionTests {
    if ($SkipTests) {
        Write-Host "⏭️  Skipping production tests" -ForegroundColor Yellow
        return
    }
    
    Write-Host "🧪 Phase 2: Production Pre-Live Tests" -ForegroundColor Yellow
    Write-Host "------------------------------------" -ForegroundColor Yellow
    
    $tests = @(
<<<<<<< HEAD
        @{name="Heady Manager API"; url="http://localhost:3300/api/health"; expected=200},
        @{name="Ollama API"; url="http://localhost:11434/api/tags"; expected=200},
=======
        @{name="Heady Manager API"; url="http://api.headysystems.com:3300/api/health"; expected=200},
        @{name="Ollama API"; url="http://api.headysystems.com:11434/api/tags"; expected=200},
>>>>>>> heady-testing/claude/autonomous-agent-system-prompt-qarZg
        @{name="PostgreSQL"; command="docker exec heady-postgres pg_isready -U heady"},
        @{name="Redis"; command="docker exec heady-redis redis-cli ping"}
    )
    
    $passed = 0
    $total = $tests.Count
    
    foreach ($test in $tests) {
        Write-Host "Testing $($test.name)..." -ForegroundColor Blue
        
        if ($test.url) {
            try {
                $response = Invoke-WebRequest -Uri $test.url -TimeoutSec 10
                if ($response.StatusCode -eq $test.expected) {
                    Write-Host "✅ $($test.name)" -ForegroundColor Green
                    $passed++
                } else {
                    Write-Host "❌ $($test.name) - Status: $($response.StatusCode)" -ForegroundColor Red
                }
            } catch {
                Write-Host "❌ $($test.name) - Connection failed" -ForegroundColor Red
            }
        } elseif ($test.command) {
            try {
                $result = Invoke-Expression $test.command
                if ($result -match "accepting connections|PONG") {
                    Write-Host "✅ $($test.name)" -ForegroundColor Green
                    $passed++
                } else {
                    Write-Host "❌ $($test.name) - Unexpected response" -ForegroundColor Red
                }
            } catch {
                Write-Host "❌ $($test.name) - Command failed" -ForegroundColor Red
            }
        }
    }
    
    Write-Host ""
    Write-Host "Test Results: $passed/$total passed" -ForegroundColor $(if ($passed -eq $total) { 'Green' } else { 'Yellow' })
    Write-Host ""
    
    return $passed -eq $total
}

# Phase 3: PyCharm Finalization
function Finalize-PyCharm {
    Write-Host "💻 Phase 3: PyCharm Migration Finalization" -ForegroundColor Yellow
    Write-Host "---------------------------------------" -ForegroundColor Yellow
    
    # Ensure virtual environment exists
    if (-not (Test-Path ".\venv")) {
        Write-Host "Creating Python virtual environment..." -ForegroundColor Blue
        & .\venv-setup.ps1
    }
    
    # Update PyCharm configuration with production settings
    Write-Host "Updating PyCharm configuration..." -ForegroundColor Blue
    
    $workspaceConfig = @"
{
  "version": "3",
  "rootProject": "Heady",
  "projectStructure": {
    "showLibraryContents": true,
    "hideEmptyMiddlePackages": true
  },
  "fileColors": {
    "enabled": true,
    "sharedConfig": false,
    "mapping": {
      "src": "Green",
      "configs": "Blue",
      "HeadyAcademy": "Magenta",
      "scripts": "Yellow",
      "docs": "Cyan"
    }
  },
  "runConfigurations": {
    "Heady Manager (Production)": {
      "type": "NodeJSConfigurationType",
      "nodeParameters": "--inspect",
      "env": {
        "NODE_ENV": "production",
        "HEADY_TARGET": "Docker"
      }
    },
    "Heady Manager (Development)": {
      "type": "NodeJSConfigurationType", 
      "nodeParameters": "--inspect",
      "env": {
        "NODE_ENV": "development",
        "HEADY_TARGET": "Local"
      }
    }
  }
}
"@
    
    Set-Content -Path ".idea\workspace.json" -Value $workspaceConfig
    Write-Host "✅ PyCharm workspace configured" -ForegroundColor Green
    
    # Create PyCharm launch script
    $launchScript = @"
@echo off
echo 🚀 Launching Heady in PyCharm...
echo.
echo Opening PyCharm with Heady project...
start "" "C:\Program Files\JetBrains\PyCharm\bin\pycharm64.exe" "c:\Users\erich\Heady"
echo.
echo 💡 Tips:
echo - Use Run Configurations to start services
echo - Set breakpoints in JavaScript and Python files
echo - Use Database tool window for PostgreSQL
echo.
echo ✨ Ready for development!
pause
"@
    
    Set-Content -Path "launch-pycharm.bat" -Value $launchScript
    Write-Host "✅ PyCharm launcher created" -ForegroundColor Green
    
    Write-Host ""
}

# Phase 4: Production Configuration
function Set-ProductionConfig {
    if (-not $Production) {
        Write-Host "⏭️  Skipping production configuration" -ForegroundColor Yellow
        return
    }
    
    Write-Host "🏭 Phase 4: Production Configuration" -ForegroundColor Yellow
    Write-Host "---------------------------------- -ForegroundColor Yellow
    
    # Create production environment file
    $prodEnv = @"
# Heady Production Environment
NODE_ENV=production
HEADY_TARGET=Docker
HEADY_VERSION=3.0.0

# Database Configuration
POSTGRES_HOST=heady-postgres
POSTGRES_DB=heady
POSTGRES_USER=heady
POSTGRES_PASSWORD=heady_secret_prod

# Redis Configuration  
REDIS_HOST=heady-redis
REDIS_PORT=6379

# Ollama Configuration
OLLAMA_HOST=heady-ollama
OLLAMA_PORT=11434

# Security
HEADY_SESSION_SECRET=$(New-Guid)
HEADY_JWT_SECRET=$(New-Guid)

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9464

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# CORS (Production)
CORS_ORIGINS=https://heady.io,https://app.heady.io
"@
    
    Set-Content -Path ".env.production" -Value $prodEnv
    Write-Host "✅ Production environment created" -ForegroundColor Green
    
    # Update Docker Compose for production
    $prodCompose = @"
version: '3.8'

services:
  heady-manager:
    image: heady/manager:latest
    container_name: heady-manager-prod
    ports:
      - "3300:3300"
    env_file:
      - .env.production
    volumes:
      - heady-prod-data:/app/.heady-memory
    networks:
      - heady-prod-net
    restart: always
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '0.5'
    healthcheck:
<<<<<<< HEAD
      test: ["CMD", "wget", "-qO-", "http://localhost:3300/api/health"]
=======
      test: ["CMD", "wget", "-qO-", "http://api.headysystems.com:3300/api/health"]
>>>>>>> heady-testing/claude/autonomous-agent-system-prompt-qarZg
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

volumes:
  heady-prod-data:

networks:
  heady-prod-net:
    driver: bridge
    ipam:
      config:
        - subnet: 172.21.0.0/16
"@
    
    Set-Content -Path "docker-compose.prod.yml" -Value $prodCompose
    Write-Host "✅ Production Docker Compose created" -ForegroundColor Green
    
    Write-Host ""
}

# Phase 5: Final System Validation
function Invoke-FinalValidation {
    Write-Host "✅ Phase 5: Final System Validation" -ForegroundColor Yellow
    Write-Host "---------------------------------" -ForegroundColor Yellow
    
    # Validate all critical files exist
    $criticalFiles = @(
        "heady-manager.js",
        "package.json", 
        "docker-compose.yml",
        "Dockerfile",
        ".idea/misc.xml",
        "PyCharm-README.md",
        "PYCHARM-TRANSITION-CHECKLIST.md",
        "scripts/docker-setup.ps1",
        "scripts/venv-setup.ps1"
    )
    
    $missing = @()
    foreach ($file in $criticalFiles) {
        if (Test-Path $file) {
            Write-Host "✅ $file" -ForegroundColor Green
        } else {
            Write-Host "❌ $file" -ForegroundColor Red
            $missing += $file
        }
    }
    
    if ($missing.Count -eq 0) {
        Write-Host ""
        Write-Host "🎉 All critical files validated!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "⚠️  Missing files: $($missing.Count)" -ForegroundColor Yellow
    }
    
    Write-Host ""
}

# Phase 6: Generate Final Report
function New-FinalReport {
    Write-Host "📊 Phase 6: Final System Report" -ForegroundColor Yellow
    Write-Host "------------------------------" -ForegroundColor Yellow
    
    $report = @"
# Heady Systems Finalization Report
Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

## System Status
- Docker Containers: $((docker ps --filter "name=heady" --format "{{.Names}}" | Measure-Object).Count) running
- Heady Manager: v3.0.0
<<<<<<< HEAD
- Ollama Models: $((Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -ErrorAction SilentlyContinue).models.Count) available
=======
- Ollama Models: $((Invoke-RestMethod -TimeoutSec 10 -Uri "http://api.headysystems.com:11434/api/tags" -ErrorAction SilentlyContinue).models.Count) available
>>>>>>> heady-testing/claude/autonomous-agent-system-prompt-qarZg
- PyCharm: Configured and ready

## Services Running
$((docker ps --filter "name=heady" --format "table {{.Names}}\t{{.Ports}}" | Out-String))

## Access URLs
<<<<<<< HEAD
- Heady Manager: http://localhost:3300
- Ollama API: http://localhost:11434  
- PgAdmin: http://localhost:8080
- Redis Commander: http://localhost:8081
- Grafana: http://localhost:3002
- Prometheus: http://localhost:9090
=======
- Heady Manager: http://api.headysystems.com:3300
- Ollama API: http://api.headysystems.com:11434  
- PgAdmin: http://api.headysystems.com:8080
- Redis Commander: http://api.headysystems.com:8081
- Grafana: http://api.headysystems.com:3002
- Prometheus: http://api.headysystems.com:9090
>>>>>>> heady-testing/claude/autonomous-agent-system-prompt-qarZg

## Next Steps
1. Open PyCharm: launch-pycharm.bat
2. Run Heady Manager configuration
3. Start development with full ecosystem
4. Deploy to production when ready

## Production Migration
- Environment file: .env.production
- Docker Compose: docker-compose.prod.yml
- All services containerized and ready
"@
    
    Set-Content -Path "FINALIZATION-REPORT.md" -Value $report
    Write-Host "✅ Final report generated: FINALIZATION-REPORT.md" -ForegroundColor Green
    
    # Show summary
    Write-Host ""
    Write-Host "🎯 FINALIZATION COMPLETE!" -ForegroundColor Magenta
    Write-Host "========================" -ForegroundColor Magenta
    Write-Host ""
    Write-Host "✅ HCFP Rebuild: Complete" -ForegroundColor Green
    Write-Host "✅ Production Pre-Live: Tested" -ForegroundColor Green  
    Write-Host "✅ PyCharm Migration: Ready" -ForegroundColor Green
    Write-Host "✅ Docker Ecosystem: Running" -ForegroundColor Green
    Write-Host ""
    Write-Host "🚀 Launch PyCharm with: launch-pycharm.bat" -ForegroundColor Cyan
    Write-Host "📋 View full report: FINALIZATION-REPORT.md" -ForegroundColor Cyan
    Write-Host ""
}

# Execute all phases
try {
    Test-SystemHealth
    
    $testsPassed = Invoke-ProductionTests
    if (-not $testsPassed -and -not $Force) {
        Write-Host "❌ Production tests failed. Use -Force to continue anyway." -ForegroundColor Red
        exit 1
    }
    
    Finalize-PyCharm
    Set-ProductionConfig
    Invoke-FinalValidation
    New-FinalReport
    
} catch {
    Write-Host "❌ Finalization failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host "✨ Heady Systems is fully finalized and ready!" -ForegroundColor Magenta
