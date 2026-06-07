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
<# ║  FILE: _archive/stale-root-misc/venv-setup.ps1                                                    ║
<# ║  LAYER: root                                                  ║
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
# ║  FILE: venv-setup.ps1                                                    ║
# ║  LAYER: scripts                                                  ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END

# Heady PyCharm Virtual Environment Setup
# This script creates and configures a Python virtual environment for PyCharm

param(
    [string]$PythonVersion = "3.12",
    [switch]$Force = $false
)

Write-Host "🔧 Heady PyCharm Virtual Environment Setup" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

$VenvPath = ".\venv"
$RequirementsFile = ".\backend\python_worker\requirements.txt"

# Check if venv already exists
if (Test-Path $VenvPath) {
    if ($Force) {
        Write-Host "🗑️  Removing existing virtual environment..." -ForegroundColor Yellow
        Remove-Item -Recurse -Force $VenvPath
    } else {
        Write-Host "✅ Virtual environment already exists at $VenvPath" -ForegroundColor Green
        Write-Host "Use -Force to recreate it" -ForegroundColor Gray
        exit 0
    }
}

# Create virtual environment
Write-Host "📦 Creating Python $PythonVersion virtual environment..." -ForegroundColor Blue
try {
    python -m venv $VenvPath
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create virtual environment"
    }
    Write-Host "✅ Virtual environment created successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Error creating virtual environment: $_" -ForegroundColor Red
    exit 1
}

# Activate and install requirements
Write-Host "📚 Installing Python dependencies..." -ForegroundColor Blue
try {
    & "$VenvPath\Scripts\Activate.ps1"
    pip install --upgrade pip
    pip install -r $RequirementsFile
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to install dependencies"
    }
    Write-Host "✅ Dependencies installed successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Error installing dependencies: $_" -ForegroundColor Red
    exit 1
}

# Install additional development dependencies
Write-Host "🛠️  Installing development dependencies..." -ForegroundColor Blue
try {
    pip install pytest pytest-asyncio black flake8 mypy
    Write-Host "✅ Development dependencies installed" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Warning: Could not install development dependencies: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎉 PyCharm virtual environment setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps for PyCharm:" -ForegroundColor Cyan
Write-Host "1. Open PyCharm" -ForegroundColor White
Write-Host "2. File → Open → Select this directory" -ForegroundColor White
Write-Host "3. Configure Python interpreter:" -ForegroundColor White
Write-Host "   - File → Settings → Project: Heady → Python Interpreter" -ForegroundColor Gray
Write-Host "   - Add New Interpreter → Existing environment" -ForegroundColor Gray
Write-Host "   - Select: $((Resolve-Path $VenvPath).Path)\Scripts\python.exe" -ForegroundColor Gray
Write-Host ""
Write-Host "✨ Ready for Heady development in PyCharm!" -ForegroundColor Magenta

