# ==============================================================================
# Raisoni ERP - Windows Desktop Installer Packaging Script
# Runs automated tests, validates Electron prerequisites, and generates separate
# development, staging, and production Windows NSIS installers.
# ==============================================================================

$ErrorActionPreference = "Stop"

$rootDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $rootDir

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Raisoni ERP -- Windows EXE Builder" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Run Automated Tests
Write-Host "[1/5] Running automated test suite..." -ForegroundColor Yellow
try {
    npm test
    if ($LASTEXITCODE -ne 0) {
        throw "Automated tests failed. Halting build process to maintain release quality."
    }
    Write-Host "  [OK] All automated backend and API tests passed." -ForegroundColor Green
} catch {
    Write-Error "Build aborted: $_"
    exit 1
}

# 2. Prepare the bundled MongoDB runtime
Write-Host ""
Write-Host "[2/4] Preparing bundled MongoDB runtime..." -ForegroundColor Yellow
try {
    npm run desktop:mongodb
    if ($LASTEXITCODE -ne 0) {
        throw "Bundled MongoDB preparation failed."
    }
    Write-Host "  [OK] Bundled MongoDB runtime is ready." -ForegroundColor Green
} catch {
    Write-Error "Build aborted: $_"
    exit 1
}

# 3. Validate Desktop Files
Write-Host ""
Write-Host "[3/4] Validating Electron configuration..." -ForegroundColor Yellow
$mainScript = Join-Path $rootDir "desktop\main.cjs"
$preloadScript = Join-Path $rootDir "desktop\preload.cjs"
$mongoBinary = Join-Path $rootDir "resources\mongodb\mongod.exe"

if (-not (Test-Path $mainScript) -or -not (Test-Path $preloadScript) -or -not (Test-Path $mongoBinary)) {
    Write-Error "Missing required desktop runtime files. Verify Electron and MongoDB build assets."
    exit 1
}
Write-Host "  [OK] Verified Electron and database runtime files." -ForegroundColor Green

# 4. Build each frontend and package each installer
Write-Host ""
Write-Host "[4/4] Generating development, staging, and production installers..." -ForegroundColor Yellow
try {
    node scripts/package-electron.cjs all --bump-version
    if ($LASTEXITCODE -ne 0) {
        throw "electron-builder encountered an error during packaging."
    }

    $releaseDir = Join-Path $rootDir "release"
    $installers = Get-ChildItem -Path $releaseDir -Filter "*.exe" -Recurse -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -like "Raisoni-ERP-*-Setup-*.exe" } |
        Sort-Object FullName

    Write-Host ""
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host " Build Successful! Windows Installers Created:" -ForegroundColor White
    if ($installers) {
        foreach ($installer in $installers) {
            Write-Host " Output File: $($installer.FullName)" -ForegroundColor Cyan
            Write-Host " File Size:   $([math]::Round($installer.Length / 1MB, 2)) MB" -ForegroundColor White
        }
    } else {
        Write-Host " Output Folder: $releaseDir" -ForegroundColor Cyan
    }
    Write-Host "==========================================================" -ForegroundColor Green
} catch {
    Write-Error "Packaging failed: $_"
    exit 1
}
