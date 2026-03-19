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
<# ║  FILE: scripts/observability.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
#!/usr/bin/env pwsh
# Heady Observability & Alerting Setup
# Production-style monitoring with actionable alerts

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("setup", "start", "stop", "status", "alert", "dashboard")]
    [string]$Action = "status",
    
    [Parameter(Mandatory=$false)]
    [string]$Message = "",
    
    [Parameter(Mandatory=$false)]
    [ValidateSet("info", "warning", "error", "critical")]
    [string]$Severity = "info"
)

$ErrorActionPreference = "Stop"

# Configuration
$HEADY_ROOT = "C:\Users\erich\Heady"
$CONFIG_DIR = "$env:USERPROFILE\.heady"
$LOG_DIR = "$CONFIG_DIR\logs"
$METRICS_DIR = "$CONFIG_DIR\metrics"
$ALERT_LOG = "$LOG_DIR\alerts.json"

# Ensure directories
New-Item -ItemType Directory -Force -Path $LOG_DIR | Out-Null
New-Item -ItemType Directory -Force -Path $METRICS_DIR | Out-Null

# Service endpoints (using new domain names)
$SERVICES = @{
<<<<<<< HEAD
    manager = "http://manager.dev.local.heady.internal:3300"
    conductor = "http://conductor.dev.local.heady.internal:8080"
    brain = "http://brain.dev.local.heady.internal:8081"
    supervisor = "http://supervisor.dev.local.heady.internal:8082"
=======
    manager = "http://manager.dev.local.headysystems.com:3300"
    conductor = "http://conductor.dev.local.headysystems.com:8080"
    brain = "http://brain.dev.local.headysystems.com:8081"
    supervisor = "http://supervisor.dev.local.headysystems.com:8082"
>>>>>>> heady-testing/claude/autonomous-agent-system-prompt-qarZg
}

function Test-ServiceHealth {
    param([string]$ServiceName, [string]$Url)
    
    try {
        $response = Invoke-RestMethod -Uri "$Url/api/health" -TimeoutSec 5 -ErrorAction Stop
        return @{ 
            Success = $true 
            Status = $response
            ResponseTime = 0 
        }
    }
    catch {
        return @{ 
            Success = $false 
            Error = $_.Exception.Message 
        }
    }
}

function Get-SystemMetrics {
    $metrics = @{
        timestamp = Get-Date -Format "o"
        cpu_percent = 0
        memory_gb = 0
        disk_gb = 0
        services = @{}
    }
    
    # Get CPU usage
    $cpu = Get-Counter '\Processor(_Total)\% Processor Time' -ErrorAction SilentlyContinue
    if ($cpu) {
        $metrics.cpu_percent = [math]::Round($cpu.CounterSamples.CookedValue, 2)
    }
    
    # Get memory
    $mem = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
    if ($mem) {
        $total = $mem.TotalVisibleMemorySize / 1MB
        $free = $mem.FreePhysicalMemory / 1MB
        $metrics.memory_gb = [math]::Round($total - $free, 2)
    }
    
    # Get disk space for Heady drive
    $drive = Get-PSDrive C -ErrorAction SilentlyContinue
    if ($drive) {
        $metrics.disk_gb = [math]::Round($drive.Free / 1GB, 2)
    }
    
    # Check all services
    foreach ($svc in $SERVICES.GetEnumerator()) {
        $health = Test-ServiceHealth -ServiceName $svc.Key -Url $svc.Value
        $metrics.services[$svc.Key] = @{
            healthy = $health.Success
            error = $health.Error
        }
    }
    
    return $metrics
}

function Send-Alert {
    param(
        [string]$Title,
        [string]$Message,
        [string]$Severity = "info",
        [string]$Component = "system"
    )
    
    $alert = @{
        id = [Guid]::NewGuid().ToString()
        timestamp = Get-Date -Format "o"
        severity = $Severity
        component = $Component
        title = $Title
        message = $Message
        acknowledged = $false
    }
    
    # Log to file
    $alert | ConvertTo-Json | Out-File -Append -FilePath $ALERT_LOG
    
    # Console output with colors
    $colorMap = @{
        info = "Cyan"
        warning = "Yellow"
        error = "Red"
        critical = "Red"
    }
    $color = $colorMap[$Severity]
    
    Write-Host ""
    Write-Host "[$Severity.ToUpper()] $Title" -ForegroundColor $color -BackgroundColor Black
    Write-Host "  $Message" -ForegroundColor White
    Write-Host "  Time: $($alert.timestamp)" -ForegroundColor Gray
    Write-Host "  Component: $Component" -ForegroundColor Gray
    Write-Host ""
    
    # Action guidance
    switch ($Severity) {
        "critical" { 
            Write-Host "  ⚠️  IMMEDIATE ACTION REQUIRED" -ForegroundColor Red
            Write-Host "  1. Check service status: .\scripts\device-management.ps1 -Action status" -ForegroundColor Yellow
            Write-Host "  2. Restart if needed: .\scripts\device-management.ps1 -Action sync" -ForegroundColor Yellow
        }
        "error" {
            Write-Host "  ⚠️  Action recommended within 15 minutes" -ForegroundColor Yellow
        }
        "warning" {
            Write-Host "  ℹ️  Monitor this issue" -ForegroundColor Gray
        }
    }
    
    return $alert
}

function Show-Dashboard {
    Clear-Host
    
    Write-Host ""
    Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║           HEADY OBSERVABILITY DASHBOARD                      ║" -ForegroundColor Cyan
    Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
    
    # System metrics
    $metrics = Get-SystemMetrics
    
    Write-Host "📊 System Metrics" -ForegroundColor Yellow
    Write-Host "   CPU: $($metrics.cpu_percent)%" -ForegroundColor $(if ($metrics.cpu_percent -gt 80) { "Red" } else { "Green" })
    Write-Host "   Memory Used: $($metrics.memory_gb) GB" -ForegroundColor $(if ($metrics.memory_gb -gt 8) { "Yellow" } else { "Green" })
    Write-Host "   Disk Free: $($metrics.disk_gb) GB" -ForegroundColor $(if ($metrics.disk_gb -lt 10) { "Red" } else { "Green" })
    Write-Host ""
    
    # Service health
    Write-Host "🔌 Service Health" -ForegroundColor Yellow
    foreach ($svc in $metrics.services.GetEnumerator()) {
        $status = if ($svc.Value.healthy) { "✅ HEALTHY" } else { "❌ DOWN" }
        $color = if ($svc.Value.healthy) { "Green" } else { "Red" }
        Write-Host "   $($svc.Key.PadRight(15)) $status" -ForegroundColor $color
        if (-not $svc.Value.healthy -and $svc.Value.error) {
            Write-Host "      Error: $($svc.Value.error)" -ForegroundColor Red
        }
    }
    Write-Host ""
    
    # Recent alerts
    if (Test-Path $ALERT_LOG) {
        $alerts = Get-Content $ALERT_LOG | 
            Where-Object { $_ } | 
<<<<<<< HEAD
            ForEach-Object { $_ | ConvertFrom-Json } |
=======
            ForEach-Object { -Parallel { $_ | ConvertFrom-Json } |
>>>>>>> heady-testing/claude/autonomous-agent-system-prompt-qarZg
            Sort-Object timestamp -Descending |
            Select-Object -First 5
        
        if ($alerts) {
            Write-Host "🚨 Recent Alerts" -ForegroundColor Yellow
            foreach ($alert in $alerts) {
                $time = [DateTime]::Parse($alert.timestamp).ToString("HH:mm:ss")
                $color = switch ($alert.severity) {
                    "critical" { "Red" }
                    "error" { "Red" }
                    "warning" { "Yellow" }
                    default { "Cyan" }
                }
                Write-Host "   [$time] [$($alert.severity.ToUpper())] $($alert.title)" -ForegroundColor $color
            }
            Write-Host ""
        }
    }
    
    # Actions available
    Write-Host "⌨️  Available Actions" -ForegroundColor Yellow
    Write-Host "   1. Press 'r' to refresh" -ForegroundColor Gray
    Write-Host "   2. Press 's' to sync devices" -ForegroundColor Gray
    Write-Host "   3. Press 'q' to quit" -ForegroundColor Gray
    Write-Host ""
}

function Start-Monitoring {
    Write-Host "Starting Heady monitoring..." -ForegroundColor Cyan
    
    # Check hosts file is configured
    $hostsContent = Get-Content "$env:SystemRoot\System32\drivers\etc\hosts" -ErrorAction SilentlyContinue
<<<<<<< HEAD
    if (-not ($hostsContent -match "heady.internal")) {
        Write-Host "⚠️  Warning: Internal domains not found in hosts file" -ForegroundColor Yellow
        Write-Host "   Run: node scripts/localhost-to-domain.js hosts" -ForegroundColor Yellow
=======
    if (-not ($hostsContent -match "headysystems.com")) {
        Write-Host "⚠️  Warning: Internal domains not found in hosts file" -ForegroundColor Yellow
        Write-Host "   Run: node scripts/api.headysystems.com-to-domain.js hosts" -ForegroundColor Yellow
>>>>>>> heady-testing/claude/autonomous-agent-system-prompt-qarZg
        Write-Host "   Then add output to C:\Windows\System32\drivers\etc\hosts" -ForegroundColor Yellow
    }
    
    # Continuous monitoring loop
    while ($true) {
        Show-Dashboard
        
        # Check for critical conditions
        $metrics = Get-SystemMetrics
        
        # Disk space alert
        if ($metrics.disk_gb -lt 5) {
            Send-Alert -Title "Low Disk Space" -Message "Only $($metrics.disk_gb) GB remaining" -Severity "critical" -Component "system"
        }
        
        # Service down alerts
        foreach ($svc in $metrics.services.GetEnumerator()) {
            if (-not $svc.Value.healthy) {
                Send-Alert -Title "Service Down" -Message "$($svc.Key) is not responding" -Severity "error" -Component $svc.Key
            }
        }
        
        # Wait before next check
<<<<<<< HEAD
        Start-Sleep -Seconds 30
=======
        # Start-Sleep -Seconds 1 # REMOVED FOR SPEED0
>>>>>>> heady-testing/claude/autonomous-agent-system-prompt-qarZg
    }
}

# Main execution
switch ($Action) {
    "setup" {
        Write-Host "Setting up Heady observability..." -ForegroundColor Cyan
        
        # Create scheduled task for monitoring
        $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-File $HEADY_ROOT\scripts\observability.ps1 -Action status"
        $trigger = New-ScheduledTaskTrigger -AtLogOn
        $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries
        
        Register-ScheduledTask -TaskName "Heady-Monitoring" -Action $action -Trigger $trigger -Settings $settings -Force -ErrorAction SilentlyContinue
        
        Write-Host "✅ Monitoring configured" -ForegroundColor Green
        Write-Host "   Logs: $LOG_DIR" -ForegroundColor Gray
        Write-Host "   Metrics: $METRICS_DIR" -ForegroundColor Gray
        Write-Host "   Alerts: $ALERT_LOG" -ForegroundColor Gray
    }
    
    "start" {
        Start-Monitoring
    }
    
    "stop" {
        Write-Host "Stopping monitoring..." -ForegroundColor Yellow
        # Kill monitoring processes if any
        Get-Process | Where-Object { $_.CommandLine -match "observability.ps1" } | Stop-Process -Force
    }
    
    "status" {
        Show-Dashboard
    }
    
    "alert" {
        if (-not $Message) {
            Write-Error "Message required for alert action. Use -Message 'your message'"
            exit 1
        }
        Send-Alert -Title "Manual Alert" -Message $Message -Severity $Severity
    }
    
    "dashboard" {
        # Single dashboard refresh
        Show-Dashboard
    }
}

Write-Host ""
