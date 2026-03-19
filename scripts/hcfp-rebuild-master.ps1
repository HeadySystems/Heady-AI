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
<# ║  FILE: scripts/hcfp-rebuild-master.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
# HCFP Automatic Rebuild Master Controller
# Zero-Tolerance Error Recovery System

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("critical", "major", "minor", "manual")]
    [string]$Severity,
    
    [Parameter(Mandatory=$true)]
    [string]$ErrorDescription,
    
    [Parameter(Mandatory=$false)]
    [string]$Component = "unknown"
)

# Configuration
$Global:HCFP_ROOT = "C:\Users\erich\Heady"
$Global:ERROR_LOG = "$HCFP_ROOT\.hcfp\errors"
$Global:REBUILD_LOG = "$HCFP_ROOT\.hcfp\rebuilds"
$Global:LEARNING_DB = "$HCFP_ROOT\.hcfp\learning.json"
$Global:PHI = 1.618033988749

function Initialize-HCFP {
    Write-Host "🚨 HCFP AUTOMATIC REBUILD SYSTEM ACTIVATED 🚨" -ForegroundColor Red
    Write-Host "Severity: $Severity" -ForegroundColor Yellow
    Write-Host "Error: $ErrorDescription" -ForegroundColor Yellow
    Write-Host "Component: $Component" -ForegroundColor Yellow
    
    # Create directories
<<<<<<< HEAD
    @($Global:ERROR_LOG, $Global:REBUILD_LOG, "$HCFP_ROOT\.hcfp") | ForEach-Object {
=======
    @($Global:ERROR_LOG, $Global:REBUILD_LOG, "$HCFP_ROOT\.hcfp") | ForEach-Object { -Parallel {
>>>>>>> heady-testing/claude/autonomous-agent-system-prompt-qarZg
        if (-not (Test-Path $_)) {
            New-Item -ItemType Directory -Path $_ -Force | Out-Null
        }
    }
}

function Stop-AllProcesses {
    Write-Host "`n⏸️ PHASE 1: FREEZING ALL PROCESSES" -ForegroundColor Cyan
    
    # Stop Node processes
<<<<<<< HEAD
    Get-Process | Where-Object { $_.ProcessName -match "node|npm|yarn|pnpm" } | ForEach-Object {
=======
    Get-Process | Where-Object { $_.ProcessName -match "node|npm|yarn|pnpm" } | ForEach-Object { -Parallel {
>>>>>>> heady-testing/claude/autonomous-agent-system-prompt-qarZg
        Write-Host "  Stopping: $($_.ProcessName) (PID: $($_.Id))"
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    }
    
    # Stop Python processes
<<<<<<< HEAD
    Get-Process | Where-Object { $_.ProcessName -match "python|pip" } | ForEach-Object {
=======
    Get-Process | Where-Object { $_.ProcessName -match "python|pip" } | ForEach-Object { -Parallel {
>>>>>>> heady-testing/claude/autonomous-agent-system-prompt-qarZg
        Write-Host "  Stopping: $($_.ProcessName) (PID: $($_.Id))"
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    }
    
    # Stop dev servers on common ports
<<<<<<< HEAD
    @(3000, 3300, 5173, 8000, 8080, 8081) | ForEach-Object {
        $port = $_
        Get-NetTCPConnection | Where-Object { 
            $_.LocalPort -eq $port -and $_.State -eq "Listen" 
        } | ForEach-Object {
=======
    @(3000, 3300, 5173, 8000, 8080, 8081) | ForEach-Object { -Parallel {
        $port = $_
        Get-NetTCPConnection | Where-Object { 
            $_.LocalPort -eq $port -and $_.State -eq "Listen" 
        } | ForEach-Object { -Parallel {
>>>>>>> heady-testing/claude/autonomous-agent-system-prompt-qarZg
            $process = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
            if ($process) {
                Write-Host "  Stopping server on port $port"
                Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
            }
        }
    }
    
    Write-Host "  ✅ All processes frozen" -ForegroundColor Green
}

function Save-Evidence {
    Write-Host "`n📸 PHASE 2: PRESERVING EVIDENCE" -ForegroundColor Cyan
    
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $evidenceDir = "$Global:ERROR_LOG\$timestamp"
    
    New-Item -ItemType Directory -Path $evidenceDir -Force | Out-Null
    
    # Save error context
    @{
        timestamp = $timestamp
        severity = $Severity
        error = $ErrorDescription
        component = $Component
        environment = @{
            node_version = & node --version 2>$null
            npm_version = & npm --version 2>$null
            python_version = & python --version 2>$null
            git_branch = & git branch --show-current 2>$null
            git_commit = & git rev-parse HEAD 2>$null
        }
    } | ConvertTo-Json -Depth 10 | Out-File "$evidenceDir\error_context.json"
    
    # Save git state
    git diff > "$evidenceDir\uncommitted_changes.diff"
    git status > "$evidenceDir\git_status.txt"
    
    Write-Host "  ✅ Evidence preserved at: $evidenceDir" -ForegroundColor Green
    return $evidenceDir
}

function Clear-ScorchedEarth {
    Write-Host "`n🔥 PHASE 3: SCORCHED EARTH CLEANUP" -ForegroundColor Cyan
    
    Set-Location $Global:HCFP_ROOT
    
    # Remove all build artifacts
    @(
        "node_modules", ".next", "build", "dist", "coverage", ".cache",
        "__pycache__", ".pytest_cache", "*.pyc", "target", "Cargo.lock"
<<<<<<< HEAD
    ) | ForEach-Object {
=======
    ) | ForEach-Object { -Parallel {
>>>>>>> heady-testing/claude/autonomous-agent-system-prompt-qarZg
        if (Test-Path $_) {
            Write-Host "  Removing: $_"
            Remove-Item -Path $_ -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
    
    # Git clean
    Write-Host "  Running git clean..."
    git clean -fdX
    
    Write-Host "  ✅ Cleanup complete" -ForegroundColor Green
}

function Restore-PristineState {
    Write-Host "`n🔄 PHASE 4: RESTORING PRISTINE STATE" -ForegroundColor Cyan
    
    # Stash any changes
    $stashMessage = "HCFP-REBUILD: Auto-stash at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    git stash push -m $stashMessage
    
    # Reset to main
    git fetch origin
    git reset --hard origin/main
    git submodule update --init --recursive
    
    Write-Host "  ✅ Repository reset to main branch" -ForegroundColor Green
}

function Install-Dependencies {
    Write-Host "`n📦 PHASE 5: INSTALLING DEPENDENCIES" -ForegroundColor Cyan
    
    # Node.js dependencies
    if (Test-Path "package.json") {
        Write-Host "  Installing Node.js dependencies..."
        npm ci --ignore-scripts
        if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }
    }
    
    # Python dependencies
    if (Test-Path "requirements.txt") {
        Write-Host "  Installing Python dependencies..."
        pip install -r requirements.txt --no-cache-dir
        if ($LASTEXITCODE -ne 0) { throw "pip install failed" }
    }
    
    Write-Host "  ✅ Dependencies installed" -ForegroundColor Green
}

function Test-ValidationSuite {
    Write-Host "`n🧪 PHASE 6: RUNNING VALIDATION SUITE" -ForegroundColor Cyan
    
    $validationPassed = $true
    
    # Run tests
    if (Test-Path "package.json") {
        Write-Host "  Running Node.js tests..."
        npm test -- --coverage --bail
        if ($LASTEXITCODE -ne 0) { $validationPassed = $false }
    }
    
    if (Test-Path "pytest.ini") {
        Write-Host "  Running Python tests..."
        pytest --cov=src --cov-fail-under=100 -xvs
        if ($LASTEXITCODE -ne 0) { $validationPassed = $false }
    }
    
    # Check Golden Ratio
    Write-Host "  Checking Golden Ratio compliance..."
    & "$PSScriptRoot\check-golden-ratio.ps1"
    if ($LASTEXITCODE -ne 0) { $validationPassed = $false }
    
    return $validationPassed
}

function Get-RootCause {
    param($EvidenceDir)
    
    Write-Host "`n🔍 PHASE 7: ROOT CAUSE ANALYSIS" -ForegroundColor Cyan
    
    # Simple 5 Whys
    $rca = @{
        error = $ErrorDescription
        why1 = "Component had an error"
        why2 = "Validation was insufficient"
        why3 = "Requirements incomplete"
        why4 = "Design phase skipped"
        why5 = "Process not enforced"
        root_cause = "Missing process enforcement"
        prevention = "Add validation gates"
    }
    
    # Save RCA
    $rca | ConvertTo-Json | Out-File "$EvidenceDir\rca.json"
    
    # Update learning database
    Update-LearningDatabase -ErrorDescription $ErrorDescription -RootCause $rca.root_cause
    
    Write-Host "  ✅ Root cause identified: $($rca.root_cause)" -ForegroundColor Green
}

function Update-LearningDatabase {
    param($ErrorDescription, $RootCause)
    
    # Initialize or load database
    if (Test-Path $Global:LEARNING_DB) {
        $db = Get-Content $Global:LEARNING_DB | ConvertFrom-Json
    } else {
        $db = @{
            total_rebuilds = 0
            errors = @()
            patterns = @{}
        }
    }
    
    # Update database
    $db.total_rebuilds++
    $db.errors += @{
        timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        error = $ErrorDescription
        root_cause = $RootCause
    }
    
    # Save database
    $db | ConvertTo-Json -Depth 10 | Out-File $Global:LEARNING_DB
    
    Write-Host "  ✅ Learning database updated" -ForegroundColor Green
}

# MAIN EXECUTION
try {
    Initialize-HCFP
    Stop-AllProcesses
    $evidenceDir = Save-Evidence
    Clear-ScorchedEarth
    Restore-PristineState
    Install-Dependencies
    $validationPassed = Test-ValidationSuite
    
    if ($validationPassed) {
        Get-RootCause -EvidenceDir $evidenceDir
        
        Write-Host "`n✅ REBUILD SUCCESSFUL" -ForegroundColor Green
        Write-Host "System restored to clean state" -ForegroundColor Green
        
        # Tag success
        git tag -a "rebuild-$(Get-Date -Format 'yyyyMMddHHmmss')" -m "Rebuild after: $ErrorDescription"
        
        exit 0
    } else {
        throw "Validation failed after rebuild"
    }
} catch {
    Write-Host "`n❌ REBUILD FAILED" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host "`n🆘 HUMAN INTERVENTION REQUIRED" -ForegroundColor Magenta
    
    exit 1
}
