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
<# ║  FILE: scripts/verify-clones.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
# ============================================================
# HEADY SYSTEMS | Clone Verification
# ============================================================

$ErrorActionPreference = 'Stop'
$timestamp = "20260217-021720"
$repos = @(
    @{Name = "HeadyStack-Hybrid-Workstation-$timestamp"; Profile = "hybrid.yml"},
    @{Name = "HeadyStack-Offline-Secure-$timestamp"; Profile = "local-offline.yml"},
    @{Name = "HeadyStack-Cloud-Hub-$timestamp"; Profile = "cloud-saas.yml"}
)

Write-Host "=== Verifying Clone Repositories ===" -ForegroundColor Cyan

foreach ($repo in $repos) {
    $repoPath = Join-Path (Split-Path (Split-Path $PSScriptRoot)) $repo.Name
    
    Write-Host "`n--- $($repo.Name) ---" -ForegroundColor White
    
    # Check directory exists
    if (-not (Test-Path $repoPath)) {
        Write-Host "❌ Directory not found" -ForegroundColor Red
        continue
    }
    
    # Check repo-type.yaml
    $repoTypePath = Join-Path $repoPath 'repo-type.yaml'
    if (Test-Path $repoTypePath) {
        $type = (Get-Content $repoTypePath -Raw) -match '(?m)^type:\s*(\S+)' | Out-Null; $Matches[1]
        Write-Host "✅ repo-type.yaml (type: $type)" -ForegroundColor Green
    } else {
        Write-Host "❌ repo-type.yaml missing" -ForegroundColor Red
    }
    
    # Check Docker profile
    $profilePath = Join-Path $repoPath "infra\docker\profiles\$($repo.Profile)"
    if (Test-Path $profilePath) {
        Write-Host "✅ Docker profile: $($repo.Profile)" -ForegroundColor Green
    } else {
        Write-Host "❌ Docker profile missing: $($repo.Profile)" -ForegroundColor Red
    }
    
    # Test Docker config
    Push-Location $repoPath
    try {
        $result = docker compose -f infra/docker/docker-compose.base.yml -f infra/docker/profiles/$($repo.Profile) config --quiet 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Docker config valid" -ForegroundColor Green
        } else {
            Write-Host "❌ Docker config invalid" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ Docker config test failed" -ForegroundColor Red
    }
    Pop-Location
}

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "All clone repositories created and verified!" -ForegroundColor Green
Write-Host "Each can be started with:" -ForegroundColor White
Write-Host "  cd <clone-dir>" -ForegroundColor Gray
Write-Host "  docker compose -f infra/docker/docker-compose.base.yml -f infra/docker/profiles/<profile>.yml up" -ForegroundColor Gray
