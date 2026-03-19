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
<# ║  FILE: scripts/check-golden-ratio.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
# Golden Ratio Compliance Checker for HCFP
# Validates that all UI elements follow Sacred Geometry principles

param(
    [string]$Path = "C:\Users\erich\Heady",
    [switch]$Fix = $false
)

$Global:PHI = 1.618033988749
$Global:PHI_TOLERANCE = 0.001
$Global:VIOLATIONS = @()

# Define PHI-based tokens
$PHI_TOKENS = @{
    "space-0" = 0
    "space-1" = 1
    "space-2" = [Math]::Round($PHI, 2)
    "space-3" = [Math]::Round([Math]::Pow($PHI, 2), 2)
    "space-4" = [Math]::Round([Math]::Pow($PHI, 3), 2)
    "space-5" = [Math]::Round([Math]::Pow($PHI, 4), 2)
    "space-6" = [Math]::Round([Math]::Pow($PHI, 5), 2)
    "space-7" = [Math]::Round([Math]::Pow($PHI, 6), 2)
    "space-8" = [Math]::Round([Math]::Pow($PHI, 7), 2)
}

function Test-GoldenRatio {
    param([string]$Value)
    
    # Remove 'px' suffix
    $numValue = [double]($Value -replace 'px', '')
    
    # Check if value is in PHI sequence
    foreach ($token in $PHI_TOKENS.Values) {
        if ([Math]::Abs($numValue - $token) -lt $Global:PHI_TOLERANCE) {
            return $true
        }
        # Also check multiples of PHI
        for ($i = 1; $i -le 10; $i++) {
            if ([Math]::Abs($numValue - ($token * $i)) -lt $Global:PHI_TOLERANCE) {
                return $true
            }
        }
    }
    return $false
}

function Get-PhiToken {
    param([string]$Value)
    
    $numValue = [double]($Value -replace 'px', '')
    
    # Find closest PHI token
    $closest = ""
    $minDiff = [double]::MaxValue
    
    foreach ($tokenName in $PHI_TOKENS.Keys) {
        $tokenValue = $PHI_TOKENS[$tokenName]
        $diff = [Math]::Abs($numValue - $tokenValue)
        if ($diff -lt $minDiff) {
            $minDiff = $diff
            $closest = "var(--$tokenName)"
        }
    }
    
    return $closest
}

Write-Host "🔍 HCFP Golden Ratio Compliance Checker" -ForegroundColor Cyan
Write-Host "φ = $Global:PHI" -ForegroundColor Yellow
Write-Host "Scanning: $Path" -ForegroundColor Yellow

# Get all CSS, SCSS, JSX, TSX files
<<<<<<< HEAD
$files = Get-ChildItem -Path $Path -Include "*.css", "*.scss", "*.jsx", "*.tsx", "*.js", "*.ts" -Recurse -ErrorAction SilentlyContinue
=======
$files = Get-ChildItem -Path $Path -Include "*.css", "*.scss", "*.jsx", "*.tsx", "*.js", "*.ts" -Recurse -Depth 5 -ErrorAction SilentlyContinue
>>>>>>> heady-testing/claude/autonomous-agent-system-prompt-qarZg

$totalFiles = 0
$filesWithViolations = 0

foreach ($file in $files) {
    $totalFiles++
<<<<<<< HEAD
    $content = Get-Content $file.FullName -Raw
=======
    $content = [System.IO.File]::ReadAllText($file.FullName)
>>>>>>> heady-testing/claude/autonomous-agent-system-prompt-qarZg
    $violations = @()
    
    # Find all pixel values
    $pixelMatches = [regex]::Matches($content, '(\d+)px')
    
    foreach ($match in $pixelMatches) {
        $value = $match.Value
        $lineNumber = ($content.Substring(0, $match.Index) -split "`n").Count
        
        # Skip 0px and 1px (common exceptions)
        if ($value -eq "0px" -or $value -eq "1px") {
            continue
        }
        
        # Check if it follows Golden Ratio
        if (-not (Test-GoldenRatio $value)) {
            $violation = @{
                File = $file.Name
                Line = $lineNumber
                Value = $value
                Suggestion = Get-PhiToken $value
            }
            $violations += $violation
            $Global:VIOLATIONS += $violation
        }
    }
    
    if ($violations.Count -gt 0) {
        $filesWithViolations++
        Write-Host "`n❌ Violations in $($file.Name):" -ForegroundColor Red
        foreach ($v in $violations) {
            Write-Host "  Line $($v.Line): $($v.Value) → $($v.Suggestion)" -ForegroundColor Yellow
        }
        
        if ($Fix) {
            Write-Host "  Fixing violations..." -ForegroundColor Cyan
            $updatedContent = $content
            foreach ($v in $violations) {
                $updatedContent = $updatedContent -replace [regex]::Escape($v.Value), $v.Suggestion
            }
            Set-Content -Path $file.FullName -Value $updatedContent
            Write-Host "  ✅ Fixed!" -ForegroundColor Green
        }
    }
}

# Summary
Write-Host "`n" + ("=" * 60) -ForegroundColor Cyan
Write-Host "SUMMARY" -ForegroundColor Cyan
Write-Host ("=" * 60) -ForegroundColor Cyan
Write-Host "Total files scanned: $totalFiles" -ForegroundColor White
Write-Host "Files with violations: $filesWithViolations" -ForegroundColor $(if ($filesWithViolations -gt 0) { "Red" } else { "Green" })
Write-Host "Total violations: $($Global:VIOLATIONS.Count)" -ForegroundColor $(if ($Global:VIOLATIONS.Count -gt 0) { "Red" } else { "Green" })

if ($Global:VIOLATIONS.Count -gt 0) {
    Write-Host "`n⚠️ Golden Ratio compliance FAILED" -ForegroundColor Red
    Write-Host "Run with -Fix flag to automatically correct violations" -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "`n✅ Golden Ratio compliance PASSED" -ForegroundColor Green
    Write-Host "All measurements follow Sacred Geometry principles (φ)" -ForegroundColor Green
    exit 0
}
