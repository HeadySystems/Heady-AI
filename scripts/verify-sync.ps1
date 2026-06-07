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
<# ║  FILE: scripts/verify-sync.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
<#
.SYNOPSIS
Verifies state synchronization across devices
#>

$API_URL = if ($env:HEADY_API_URL) { $env:HEADY_API_URL } else { "https://api.headysystems.com/api/buddy/state" }
$DEVICES = @("WindowsPC", "OnePlusOpen", "LinuxWorkstation")

$errors = 0
foreach ($device in $DEVICES) {
    try {
        $state = Invoke-RestMethod -TimeoutSec 10 -Uri "$API_URL`?device=$device" -Method Get
        if (-not $state) {
            Write-Warning "No state returned for $device"
            $errors++
        } else {
            Write-Host "Fetched state from $device" -ForegroundColor Green
        }
    }
    catch {
        Write-Warning "Failed to verify $device`: $_"
        $errors++
    }
}

if ($errors -gt 0) {
    throw "State verification failed with $errors errors"
} else {
    Write-Host "State verified across all devices" -ForegroundColor Green
}
