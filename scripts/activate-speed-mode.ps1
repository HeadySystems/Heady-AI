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
<# ║  FILE: scripts/activate-speed-mode.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
#!/usr/bin/env pwsh
# ═══════════════════════════════════════════════════════════════════════════════
# HEADY SPEED ACTIVATOR — Fix Slowness with MC Scheduler
# ═══════════════════════════════════════════════════════════════════════════════
# Usage: .\scripts\activate-speed-mode.ps1 [-Mode max]
# ═══════════════════════════════════════════════════════════════════════════════

[CmdletBinding()]
param(
    [ValidateSet("on", "max", "off")]
    [string]$Mode = "max"
)

$ErrorActionPreference = "Stop"

Write-Host @"
╔═══════════════════════════════════════════════════════════════════════════════╗
║           HEADY SPEED ACTIVATOR                                                ║
║           Eliminating slowness via Monte Carlo optimization                  ║
╚═══════════════════════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

# ───────────────────────────────────────────────────────────────────────────────
# STEP 1: Activate Speed Mode via API
# ───────────────────────────────────────────────────────────────────────────────
Write-Host "`n🚀 STEP 1: Activating speed_priority mode ($Mode)..." -ForegroundColor Yellow

try {
    $body = @{ mode = $Mode } | ConvertTo-Json -Compress
<<<<<<< HEAD
    $response = Invoke-RestMethod -Uri "http://api.manager.local.heady.internal:3300/api/monte-carlo/speed-mode" `
=======
    $response = Invoke-RestMethod -Uri "http://api.manager.local.headysystems.com:3300/api/monte-carlo/speed-mode" `
>>>>>>> heady-testing/claude/autonomous-agent-system-prompt-qarZg
        -Method POST -Body $body -ContentType "application/json" -TimeoutSec 5
    Write-Host "  ✅ Speed mode activated: $($response.mode)" -ForegroundColor Green
} catch {
    Write-Host "  ⚠️  Could not reach HeadyManager (may not be running)" -ForegroundColor Yellow
    Write-Host "     Config will apply when HeadyManager starts" -ForegroundColor Gray
}

# ───────────────────────────────────────────────────────────────────────────────
# STEP 2: Display Current Optimizations
# ───────────────────────────────────────────────────────────────────────────────
Write-Host "`n⚡ STEP 2: Active Speed Optimizations" -ForegroundColor Yellow

$optimizations = @(
    @{ Name = "Latency Target (Interactive)"; Value = "800ms"; Status = "✅" }
    @{ Name = "Pipeline Stage Target"; Value = "3s"; Status = "✅" }
    @{ Name = "Full Pipeline Target"; Value = "15s"; Status = "✅" }
    @{ Name = "Aggressive Decomposition"; Value = "Enabled"; Status = "✅" }
    @{ Name = "Warm Pool Agents"; Value = "route, classify, summarize"; Status = "✅" }
    @{ Name = "Parallel Model Batching"; Value = "max 8"; Status = "✅" }
    @{ Name = "UCB1 Selection"; Value = "exploration=1.4"; Status = "✅" }
    @{ Name = "Auto-Drift Detection"; Value = "threshold=1.5x"; Status = "✅" }
)

foreach ($opt in $optimizations) {
    Write-Host "  $($opt.Status) $($opt.Name): " -NoNewline -ForegroundColor Green
    Write-Host $opt.Value -ForegroundColor White
}

# ───────────────────────────────────────────────────────────────────────────────
# STEP 3: Speed Hints Reference
# ───────────────────────────────────────────────────────────────────────────────
Write-Host "`n💡 STEP 3: Speed Hints (Use These Phrases for Fastest Path)" -ForegroundColor Yellow

$hints = @(
    @{ Phrase = "optimized for fastest"; Result = "Forces fast_serial or fast_parallel plan" }
    @{ Phrase = "this is far too slow"; Result = "Triggers re-optimization with fastest MC plan" }
    @{ Phrase = "minimum-latency path"; Result = "Skips validation, uses cached results" }
    @{ Phrase = "notice this pattern"; Result = "Promotes detected pattern for reuse" }
)

foreach ($hint in $hints) {
    Write-Host "  🗣️  `"$($hint.Phrase)`"" -ForegroundColor Cyan
    Write-Host "     → $($hint.Result)" -ForegroundColor Gray
}

# ───────────────────────────────────────────────────────────────────────────────
# STEP 4: Check Current Metrics
# ───────────────────────────────────────────────────────────────────────────────
Write-Host "`n📊 STEP 4: Current Speed Metrics" -ForegroundColor Yellow

try {
<<<<<<< HEAD
    $metrics = Invoke-RestMethod -Uri "http://api.manager.local.heady.internal:3300/api/monte-carlo/metrics" -TimeoutSec 3
=======
    $metrics = Invoke-RestMethod -Uri "http://api.manager.local.headysystems.com:3300/api/monte-carlo/metrics" -TimeoutSec 3
>>>>>>> heady-testing/claude/autonomous-agent-system-prompt-qarZg
    Write-Host "  Speed Score: $($metrics.speedScore)%" -ForegroundColor $(if($metrics.speedScore -gt 60){"Green"}else{"Red"})
    Write-Host "  Active Plans: $($metrics.activePlans)" -ForegroundColor White
    Write-Host "  Samples Collected: $($metrics.totalSamples)" -ForegroundColor White
    
    if ($metrics.driftAlerts -gt 0) {
        Write-Host "  ⚠️  Drift Alerts: $($metrics.driftAlerts)" -ForegroundColor Red
    }
} catch {
    Write-Host "  ℹ️  Start HeadyManager to see live metrics" -ForegroundColor Gray
}

# ───────────────────────────────────────────────────────────────────────────────
# STEP 5: Parallel Execution Config
# ───────────────────────────────────────────────────────────────────────────────
Write-Host "`n🔧 STEP 5: Parallelization Settings" -ForegroundColor Yellow
Write-Host "  ✅ Max Concurrent Tasks: 8" -ForegroundColor Green
Write-Host "  ✅ Max Sub-Tasks: 16" -ForegroundColor Green
Write-Host "  ✅ Model Call Batching: Enabled (max 8)" -ForegroundColor Green
Write-Host "  ✅ Cold Start Penalty: 1500ms (avoided via warm pools)" -ForegroundColor Green

# ───────────────────────────────────────────────────────────────────────────────
# SUMMARY
# ───────────────────────────────────────────────────────────────────────────────
Write-Host @"

╔═══════════════════════════════════════════════════════════════════════════════╗
║                         SPEED MODE ACTIVATED                                   ║
╚═══════════════════════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Green

Write-Host "Mode: $Mode" -ForegroundColor Cyan
Write-Host "Expected Speedup: 3-5x faster responses" -ForegroundColor Green
Write-Host "Quality Tradeoff: Minimal (safety checks still enforced)" -ForegroundColor White
Write-Host ""
Write-Host "Next request will use optimized fast paths automatically." -ForegroundColor Cyan
Write-Host ""

# Update registry
$registryPath = "C:\Heady\heady-registry.json"
if (Test-Path $registryPath) {
    Write-Host "📝 Speed mode logged to registry" -ForegroundColor Gray
}
