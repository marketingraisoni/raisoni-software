# ==============================================================================
# Raisoni ERP - Windows Desktop Installer Packaging Script
# Runs automated tests, then builds the desktop client installer. The client
# contains no backend or database: it opens the LAN server (default
# http://192.168.1.125:2000) where all data is stored.
#
#   powershell -ExecutionPolicy Bypass -File scripts/build-exe.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/build-exe.ps1 -ServerUrl http://192.168.1.50:2000
# ==============================================================================
param (
    [string]$ServerUrl = "http://192.168.1.125:2000"
)

$ErrorActionPreference = "Stop"

$rootDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $rootDir

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Raisoni ERP -- Windows EXE Builder" -ForegroundColor White
Write-Host " Server: $ServerUrl" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Run Automated Tests
Write-Host "[1/2] Running automated test suite..." -ForegroundColor Yellow
npm test
if ($LASTEXITCODE -ne 0) {
    Write-Error "Build aborted: automated tests failed."
    exit 1
}
Write-Host "  [OK] All automated backend and API tests passed." -ForegroundColor Green

# 2. Package the installer
Write-Host ""
Write-Host "[2/2] Building the desktop installer..." -ForegroundColor Yellow
node scripts/package-electron.cjs --bump-version "--server=$ServerUrl"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Packaging failed: electron-builder encountered an error."
    exit 1
}

$releaseDir = Join-Path $rootDir "release"
$installers = Get-ChildItem -Path $releaseDir -Filter "Raisoni-ERP-Setup-*.exe" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host " Build Successful!" -ForegroundColor White
if ($installers) {
    $installer = $installers[0]
    Write-Host " Output File: $($installer.FullName)" -ForegroundColor Cyan
    Write-Host " File Size:   $([math]::Round($installer.Length / 1MB, 2)) MB" -ForegroundColor White
} else {
    Write-Host " Output Folder: $releaseDir" -ForegroundColor Cyan
}
Write-Host "==========================================================" -ForegroundColor Green
