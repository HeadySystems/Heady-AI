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
<# ║  FILE: _archive/packages/install.ps1                                                    ║
<# ║  LAYER: root                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
# ═══ Heady AI — Windows Installer ═══
# iwr https://headyme.com/install.ps1 | iex

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "  ═══════════════════════════════════════" -ForegroundColor Magenta
Write-Host "   🐝 Heady AI — Intelligence Layer" -ForegroundColor Magenta
Write-Host "   Windows Installer" -ForegroundColor Magenta
Write-Host "  ═══════════════════════════════════════" -ForegroundColor Magenta
Write-Host ""

# Check Node
try { $nodeVer = (node -v).TrimStart('v') } catch {
    Write-Host "❌ Node.js 18+ required. Install from https://nodejs.org" -ForegroundColor Red
    exit 1
}

$major = [int]($nodeVer.Split('.')[0])
if ($major -lt 18) {
    Write-Host "❌ Node.js 18+ required (found v$nodeVer)" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Node.js v$nodeVer" -ForegroundColor Green

# Install
Write-Host "📦 Installing Heady CLI..." -ForegroundColor Cyan
npm install -g heady-hive-sdk

Write-Host "📦 Installing Heady MCP Server..." -ForegroundColor Cyan
npm install -g heady-mcp-server

# Configure Claude Desktop MCP
$claudeConfig = "$env:APPDATA\Claude\claude_desktop_config.json"
$claudeDir = "$env:APPDATA\Claude"
if (Test-Path $claudeDir) {
    Write-Host "🔌 Configuring Claude Desktop MCP..." -ForegroundColor Cyan
    $config = @{ mcpServers = @{ heady = @{ command = "npx"; args = @("-y", "heady-mcp-server"); env = @{ HEADY_URL = "http://127.0.0.1:3301" } } } }
    if (Test-Path $claudeConfig) {
        $existing = Get-Content $claudeConfig | ConvertFrom-Json
        $existing.mcpServers | Add-Member -NotePropertyName "heady" -NotePropertyValue $config.mcpServers.heady -Force
        $existing | ConvertTo-Json -Depth 10 | Set-Content $claudeConfig
    } else {
        $config | ConvertTo-Json -Depth 10 | Set-Content $claudeConfig
    }
    Write-Host "✓ Claude Desktop MCP configured" -ForegroundColor Green
}

Write-Host ""
Write-Host "═══════════════════════════════════════" -ForegroundColor Magenta
Write-Host "✅ Heady AI installed!" -ForegroundColor Green
Write-Host ""
Write-Host "  Run:   heady brain `"hello world`""
Write-Host "  MCP:   npx heady-mcp-server"
Write-Host "  Web:   https://headyme.com"
Write-Host "  Hub:   https://headymcp.com"
Write-Host "═══════════════════════════════════════" -ForegroundColor Magenta
