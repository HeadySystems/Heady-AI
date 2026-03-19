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
<# ║  FILE: scripts/setup-e-folder.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
#!/usr/bin/env pwsh
#Requires -RunAsAdministrator
# ═══════════════════════════════════════════════════════════════════════════════
# HEADY SYSTEMS — DESKTOP E FOLDER SETUP
# Creates a branded E drive experience on the Desktop with everything
# ═══════════════════════════════════════════════════════════════════════════════

[CmdletBinding()]
param(
    [switch]$SkipCopy,
    [switch]$WhatIf
)

# Error handling
$ErrorActionPreference = "Stop"

# ───────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ───────────────────────────────────────────────────────────────────────────────
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$EFolder = Join-Path $DesktopPath "E"
$SourcePath = $PSScriptRoot | Split-Path -Parent  # Heady project root

# Colors for output
$Colors = @{
    Header = "Cyan"
    Success = "Green"
    Warning = "Yellow"
    Error = "Red"
    Info = "White"
}

# ───────────────────────────────────────────────────────────────────────────────
# FUNCTIONS
# ───────────────────────────────────────────────────────────────────────────────
function Write-Header {
    param([string]$Text)
    Write-Host "`n╔═══════════════════════════════════════════════════════════════════════════════╗" -ForegroundColor $Colors.Header
    Write-Host "║ $Text" -ForegroundColor $Colors.Header
    Write-Host "╚═══════════════════════════════════════════════════════════════════════════════╝" -ForegroundColor $Colors.Header
}

function Write-Success { param([string]$Text) Write-Host "  ✅ $Text" -ForegroundColor $Colors.Success }
function Write-Info { param([string]$Text) Write-Host "  ℹ️  $Text" -ForegroundColor $Colors.Info }
function Write-Warning { param([string]$Text) Write-Host "  ⚠️  $Text" -ForegroundColor $Colors.Warning }

# ───────────────────────────────────────────────────────────────────────────────
# MAIN SETUP
# ───────────────────────────────────────────────────────────────────────────────
Write-Header "HEADY SYSTEMS — Desktop E Folder Setup"

if ($WhatIf) {
    Write-Host "`n🔍 WHATIF MODE: No changes will be made`n" -ForegroundColor Yellow -BackgroundColor Black
}

# Check if E folder exists
if (Test-Path $EFolder) {
    Write-Warning "E folder already exists at: $EFolder"
    $response = Read-Host "  Replace existing folder? (y/N)"
    if ($response -ne 'y') {
        Write-Info "Setup cancelled. Existing folder preserved."
        exit 0
    }
    if (!$WhatIf) {
        Remove-Item -Path $EFolder -Recurse -Force
        Write-Success "Removed existing E folder"
    }
}

# Create folder structure
Write-Host "`n📁 Creating E folder structure..." -ForegroundColor $Colors.Header

$Folders = @(
    "HeadyOS\heady"
    "HeadyOS\scripts"
    "HeadyOS\node"
    "HeadyOS\python"
    "ISOs"
    "ventoy"
    "distribution\bundles"
    "distribution\payment-schema"
    "distribution\gift-packs"
    "projects"
    "backups"
)

foreach ($folder in $Folders) {
    $path = Join-Path $EFolder $folder
    if (!$WhatIf) {
        New-Item -ItemType Directory -Path $path -Force | Out-Null
    }
    Write-Info "Created: E\$folder"
}

# Copy Heady project files
if (!$SkipCopy -and !$WhatIf) {
    Write-Host "`n📦 Copying Heady project files..." -ForegroundColor $Colors.Header
    
    $CopyItems = @(
        @{ Source = "heady-manager.js"; Dest = "HeadyOS\heady\" }
        @{ Source = "package.json"; Dest = "HeadyOS\heady\" }
        @{ Source = "package-lock.json"; Dest = "HeadyOS\heady\" }
        @{ Source = "configs"; Dest = "HeadyOS\heady\" }
        @{ Source = "src"; Dest = "HeadyOS\heady\" }
        @{ Source = "frontend"; Dest = "HeadyOS\heady\" }
        @{ Source = "public"; Dest = "HeadyOS\heady\" }
        @{ Source = "scripts"; Dest = "HeadyOS\" }
        @{ Source = "distribution"; Dest = "" }
        @{ Source = "docs"; Dest = "HeadyOS\heady\" }
        @{ Source = "heady-registry.json"; Dest = "HeadyOS\heady\" }
        @{ Source = "README.md"; Dest = "HeadyOS\heady\" }
        @{ Source = "CLAUDE.md"; Dest = "HeadyOS\heady\" }
        @{ Source = "render.yaml"; Dest = "HeadyOS\heady\" }
        @{ Source = "Dockerfile"; Dest = "HeadyOS\heady\" }
        @{ Source = "docker-compose.yml"; Dest = "HeadyOS\heady\" }
    )
    
    foreach ($item in $CopyItems) {
        $src = Join-Path $SourcePath $item.Source
        $dst = Join-Path $EFolder $item.Dest
        
        if (Test-Path $src) {
            Copy-Item -Path $src -Destination $dst -Recurse -Force
            Write-Success "Copied: $($item.Source)"
        } else {
            Write-Warning "Not found: $($item.Source)"
        }
    }
}

# Create launcher scripts
Write-Host "`n🚀 Creating launcher scripts..." -ForegroundColor $Colors.Header

$Launchers = @{
    "🚀 Launch HeadyManager.bat" = @"
@echo off
cd /d "%~dp0HeadyOS\heady"
echo.
echo ╔══════════════════════════════════════════════════════════════════╗
echo ║  Starting HeadyManager on port 3300...                           ║
echo ╚══════════════════════════════════════════════════════════════════╝
echo.
npm install 2>nul
node heady-manager.js
pause
"@

    "💻 Heady Shell.bat" = @"
@echo off
cd /d "%~dp0HeadyOS\heady"
cls
echo.
echo ╔══════════════════════════════════════════════════════════════════╗
echo ║  HEADY SHELL - Sacred Geometry Environment                        ║
echo ║  ∞ Organic Systems · Breathing Interfaces · De-Optimization       ║
echo ╚══════════════════════════════════════════════════════════════════╝
echo.
echo Commands:
echo   heady status      - Check system status
echo   heady sync        - Sync all repositories
echo   heady build       - Run clean build
echo   heady deploy      - Deploy to cloud
echo   heady domains     - List service domains
echo   heady health      - Health check all services
echo.
set HEADY_ENV=local
<<<<<<< HEAD
set HEADY_DOMAIN_ROOT=heady.internal
=======
set HEADY_DOMAIN_ROOT=headysystems.com
>>>>>>> heady-testing/claude/autonomous-agent-system-prompt-qarZg
cmd /k
"@

    "📊 Status Check.bat" = @"
@echo off
echo.
echo ╔══════════════════════════════════════════════════════════════════╗
echo ║  HEADY SYSTEMS STATUS CHECK                                       ║
echo ╚══════════════════════════════════════════════════════════════════╝
echo.
echo Checking services...
echo.
<<<<<<< HEAD
curl -s http://api.manager.local.heady.internal:3300/api/health >nul 2>&1
if %errorlevel% == 0 (
    echo   ✅ HeadyManager: RUNNING on api.manager.local.heady.internal:3300
=======
curl -s http://api.manager.local.headysystems.com:3300/api/health >nul 2>&1
if %errorlevel% == 0 (
    echo   ✅ HeadyManager: RUNNING on api.manager.local.headysystems.com:3300
>>>>>>> heady-testing/claude/autonomous-agent-system-prompt-qarZg
) else (
    echo   ❌ HeadyManager: NOT RUNNING
    echo      Run ^"Launch HeadyManager.bat^" to start
)
echo.
echo Press any key to exit...
pause >nul
"@

    "🎁 Gift Pack Setup.bat" = @"
@echo off
cd /d "%~dp0distribution\bundles"
echo.
echo ╔══════════════════════════════════════════════════════════════════╗
echo ║  HEADY GIFT PACK SETUP                                            ║
echo ║  Share Heady with Friends ^& Family                                ║
echo ╚══════════════════════════════════════════════════════════════════╝
echo.
echo Available gift packs:
echo.
type gift-pack-family.yaml 2>nul | findstr "name: \"" | head -1
echo.
echo To send gift invites:
echo   1. Open gift-pack-family.yaml to configure recipients
echo   2. Run: heady gifts send --pack gift-pack-family.yaml
echo.
pause
"@

    "📖 Open README.bat" = @"
@echo off
start "" "%~dp0README.html"
"@
}

foreach ($name in $Launchers.Keys) {
    $path = Join-Path $EFolder $name
    if (!$WhatIf) {
        Set-Content -Path $path -Value $Launchers[$name] -Encoding ASCII
    }
    Write-Success "Created: $name"
}

# Create branded desktop.ini for custom icon
Write-Host "`n🎨 Creating branded folder icon..." -ForegroundColor $Colors.Header

$DesktopIni = @"
[.ShellClassInfo]
IconResource=C:\Windows\System32\shell32.dll,14
IconFile=%SystemRoot%\System32\shell32.dll
IconIndex=14
InfoTip=Heady Systems - Sacred Geometry Desktop Portal
"@

if (!$WhatIf) {
    $iniPath = Join-Path $EFolder "desktop.ini"
    Set-Content -Path $iniPath -Value $DesktopIni -Encoding ASCII
    (Get-Item $iniPath -Force).Attributes = 'Hidden,System'
    (Get-Item $EFolder).Attributes = 'ReadOnly'
}
Write-Success "Applied Sacred Geometry branding"

# Create README.html
Write-Host "`n📝 Creating README..." -ForegroundColor $Colors.Header

$ReadmeHtml = @"
<!DOCTYPE html>
<html>
<head>
    <title>Heady Systems - E Drive</title>
    <style>
        body { font-family: 'Segoe UI', sans-serif; background: #1a1a2e; color: #fff; margin: 40px; }
        h1 { color: #7B68EE; text-shadow: 0 0 20px #7B68EE; }
        h2 { color: #FFD700; border-bottom: 2px solid #7B68EE; padding-bottom: 10px; }
        .ascii { font-family: 'Consolas', monospace; color: #7B68EE; font-size: 12px; line-height: 1.2; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border: 1px solid #7B68EE; }
        th { background: #7B68EE; color: #1a1a2e; }
        tr:nth-child(even) { background: #252542; }
        .highlight { color: #FFD700; }
        code { background: #252542; padding: 2px 6px; border-radius: 3px; }
        .section { margin: 40px 0; }
    </style>
</head>
<body>
    <div class="ascii">
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║   █╗  █╗███████╗ █████╗ ██████╗ █╗   █╗                                    ║
║   █║  █║█╔════╝█╔══█╗█╔══█╗╚█╗ █╔╝                                    ║
║   ███████║█████╗  ███████║█║  █║ ╚████╔╝                                     ║
║   █╔══█║█╔══╝  █╔══█║█║  █║  ╚█╔╝                                      ║
║   █║  █║███████╗█║  █║██████╔╝   █║                                        ║
║   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                                        ║
║                                                                               ║
║   ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces                ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
    </div>

    <h1>🌟 Welcome to Your Heady E Drive</h1>
    
    <div class="section">
        <h2>🚀 Quick Start</h2>
        <table>
            <tr><th>Action</th><th>What It Does</th></tr>
            <tr><td><span class="highlight">🚀 Launch HeadyManager.bat</span></td><td>Start the Heady orchestrator on port 3300</td></tr>
            <tr><td><span class="highlight">💻 Heady Shell.bat</span></td><td>Open the sacred geometry development environment</td></tr>
            <tr><td><span class="highlight">📊 Status Check.bat</span></td><td>Quick health check of all services</td></tr>
            <tr><td><span class="highlight">🎁 Gift Pack Setup.bat</span></td><td>Set up gift packs for friends & family</td></tr>
        </table>
    </div>

    <div class="section">
        <h2>📁 Folder Structure</h2>
        <pre>
E:
├── 🌟 <span class="highlight">HeadyOS/</span>           # Core operating environment
│   ├── 📦 heady/        # Main Heady repository
│   ├── 📜 scripts/      # Automation scripts
│   └── 🐍 python/       # Python worker
├── 🎁 <span class="highlight">distribution/</span>      # Distribution & monetization
│   ├── 💰 payment-schema.yaml
│   └── 📦 bundles/      # Product bundles
├── 📦 ISOs/             # Bootable OS images
├── 🔌 ventoy/           # Multi-boot USB
├── 💻 projects/         # Your projects
└── 💾 backups/          # Automated backups
        </pre>
    </div>

    <div class="section">
        <h2>💰 Gift Pack — Friends & Family</h2>
        <p>Share Heady with 5 loved ones for just <span class="highlight">">$99</span> (save $146!)</p>
        <ul>
            <li>✅ QR code cards for easy setup</li>
            <li>✅ Personalized email invites</li>
            <li>✅ 10GB shared storage</li>
            <li>✅ Private Discord community</li>
        </ul>
        <p>Open <code>gift-pack-family.yaml</code> to configure and send!</p>
    </div>

    <div class="section">
        <h2>🔗 Service Discovery</h2>
<<<<<<< HEAD
        <p>No more localhost! All services use proper domains:</p>
        <table>
            <tr><th>Service</th><th>Domain</th></tr>
            <tr><td>HeadyManager</td><td><code>api.manager.local.heady.internal:3300</code></td></tr>
            <tr><td>Frontend</td><td><code>app.local.heady.internal:5173</code></td></tr>
            <tr><td>Database</td><td><code>db.postgres.local.heady.internal:5432</code></td></tr>
=======
        <p>No more api.headysystems.com! All services use proper domains:</p>
        <table>
            <tr><th>Service</th><th>Domain</th></tr>
            <tr><td>HeadyManager</td><td><code>api.manager.local.headysystems.com:3300</code></td></tr>
            <tr><td>Frontend</td><td><code>app.local.headysystems.com:5173</code></td></tr>
            <tr><td>Database</td><td><code>db.postgres.local.headysystems.com:5432</code></td></tr>
>>>>>>> heady-testing/claude/autonomous-agent-system-prompt-qarZg
        </table>
    </div>

    <div class="section">
        <h2>∞ Sacred Geometry ∞</h2>
        <p><strong>Organic Systems · Breathing Interfaces · De-Optimization</strong></p>
        <p>Built with 💜 by Heady Systems | Version 3.0.0</p>
    </div>
</body>
</html>
"@

if (!$WhatIf) {
    $readmePath = Join-Path $EFolder "README.html"
    Set-Content -Path $readmePath -Value $ReadmeHtml -Encoding UTF8
}
Write-Success "Created: README.html"

# Create summary file
if (!$WhatIf) {
    $summary = @"
HEADY SYSTEMS - E FOLDER SETUP COMPLETE
========================================
Location: $EFolder
Created: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

CONTENTS:
---------
✅ HeadyOS/ - Core operating environment
✅ distribution/ - Bundles & payment schema
✅ ISOs/ - Bootable OS images
✅ projects/ - Your workspace
✅ backups/ - Auto-backup location

LAUNCHERS:
----------
🚀 Launch HeadyManager.bat - Start orchestrator
💻 Heady Shell.bat - Dev environment
📊 Status Check.bat - Health check
🎁 Gift Pack Setup.bat - Gift configuration

NEXT STEPS:
-----------
1. Double-click "🚀 Launch HeadyManager.bat" to start
2. Open "💻 Heady Shell.bat" for development
3. Configure gift packs in distribution/bundles/
4. Check README.html for full documentation

SACRED GEOMETRY · ORGANIC SYSTEMS · BREATHING INTERFACES
"@
    Set-Content -Path (Join-Path $EFolder "SETUP-SUMMARY.txt") -Value $summary
}

# Final output
Write-Header "SETUP COMPLETE"

if ($WhatIf) {
    Write-Host "`n📝 This was a dry run. Run without -WhatIf to create the E folder." -ForegroundColor Yellow
} else {
    Write-Host "`n✅ E folder created successfully at:" -ForegroundColor $Colors.Success
    Write-Host "   $EFolder`n" -ForegroundColor White
    Write-Host "📌 NEXT STEPS:" -ForegroundColor $Colors.Header
    Write-Host "   1. Open the E folder on your Desktop" -ForegroundColor $Colors.Info
    Write-Host "   2. Double-click '🚀 Launch HeadyManager.bat'" -ForegroundColor $Colors.Info
    Write-Host "   3. Check '🎁 Gift Pack Setup.bat' to share with family" -ForegroundColor $Colors.Info
    Write-Host "`n🌟 Welcome to the Sacred Geometry ecosystem!`n" -ForegroundColor $Colors.Header
}

# Open folder if not WhatIf
if (!$WhatIf) {
    Start-Process explorer.exe -ArgumentList $EFolder
}
