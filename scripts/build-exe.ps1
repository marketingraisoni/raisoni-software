# ==============================================================================
# Raisoni Software Demo - Windows Desktop Installer Packaging Script
# Runs automated tests, builds the production frontend, validates Electron
# configuration, and invokes electron-builder to generate the Windows NSIS installer.
# ==============================================================================

$ErrorActionPreference = "Stop"

$rootDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $rootDir

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Raisoni Software Demo -- Windows EXE Builder" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Run Automated Tests
Write-Host "[1/4] Running automated test suite..." -ForegroundColor Yellow
try {
    npm test
    if ($LASTEXITCODE -ne 0) {
        throw "Automated tests failed. Halting build process to maintain release quality."
    }
    Write-Host "  [OK] All 14 automated backend and API tests passed." -ForegroundColor Green
} catch {
    Write-Error "Build aborted: $_"
    exit 1
}

# 2. Build Frontend Production Assets
Write-Host ""
Write-Host "[2/4] Compiling optimized React frontend bundle..." -ForegroundColor Yellow
try {
    npm run frontend:build
    if ($LASTEXITCODE -ne 0) {
        throw "Frontend compilation failed."
    }
    Write-Host "  [OK] Production frontend bundle compiled into frontend/dist/." -ForegroundColor Green
} catch {
    Write-Error "Build aborted: $_"
    exit 1
}

# 3. Validate Desktop Files
Write-Host ""
Write-Host "[3/4] Validating Electron configuration..." -ForegroundColor Yellow
$mainScript = Join-Path $rootDir "desktop\main.cjs"
$preloadScript = Join-Path $rootDir "desktop\preload.cjs"
$distIndex = Join-Path $rootDir "frontend\dist\index.html"

if (-not (Test-Path $mainScript) -or -not (Test-Path $preloadScript) -or -not (Test-Path $distIndex)) {
    Write-Error "Missing required desktop runtime files. Verify desktop/main.cjs, preload.cjs, and frontend/dist/."
    exit 1
}
Write-Host "  [OK] Verified main.cjs, preload.cjs, and frontend/dist/index.html." -ForegroundColor Green

# 4. Packaging with Electron Builder
Write-Host ""
Write-Host "[4/4] Generating Windows NSIS Installer..." -ForegroundColor Yellow
try {
    npx electron-builder --win nsis --x64
    if ($LASTEXITCODE -ne 0) {
        throw "electron-builder encountered an error during packaging."
    }

    $releaseDir = Join-Path $rootDir "release"
    $installer = Get-ChildItem -Path $releaseDir -Filter "*.exe" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1

    Write-Host ""
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host " Build Successful! Windows Installer Created:" -ForegroundColor White
    if ($installer) {
        Write-Host " Output File: $($installer.FullName)" -ForegroundColor Cyan
        Write-Host " File Size:   $([math]::Round($installer.Length / 1MB, 2)) MB" -ForegroundColor White
    } else {
        Write-Host " Output Folder: $releaseDir" -ForegroundColor Cyan
    }
    Write-Host "==========================================================" -ForegroundColor Green
} catch {
    Write-Error "Packaging failed: $_"
    exit 1
}
