param (
    [ValidateSet("development", "staging", "production")]
    [string]$Environment = "development"
)

$ErrorActionPreference = "Stop"
$rootDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $rootDir

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Raisoni ERP -- $Environment Desktop" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan

if (-not (Test-Path "frontend\dist\index.html")) {
    Write-Host "Building the frontend first..." -ForegroundColor Yellow
    npm --prefix frontend run build -- --mode $Environment
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

if (-not (Test-Path "resources\mongodb\mongod.exe")) {
    Write-Host "Preparing the embedded database runtime..." -ForegroundColor Yellow
    npm run desktop:mongodb
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

$env:APP_ENV = $Environment
$env:NODE_ENV = if ($Environment -eq "development") { "development" } else { "production" }
npx electron desktop/main.cjs
