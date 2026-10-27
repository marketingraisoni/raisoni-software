$ErrorActionPreference = "Stop"
$rootDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $rootDir

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Raisoni ERP -- Three-Environment Setup" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan

Write-Host "[1/5] Checking Node.js and npm..." -ForegroundColor Yellow
try {
    $nodeVersion = (node -v).Trim()
    $npmVersion = (npm -v).Trim()
    Write-Host "  [OK] Node.js $nodeVersion; npm $npmVersion" -ForegroundColor Green
} catch {
    Write-Error "Node.js 18+ and npm must be installed and available in PATH."
    exit 1
}

Write-Host "[2/5] Checking MongoDB..." -ForegroundColor Yellow
$mongoService = Get-Service -Name "MongoDB" -ErrorAction SilentlyContinue
if ($mongoService -and $mongoService.Status -eq "Running") {
    Write-Host "  [OK] MongoDB Windows service is running." -ForegroundColor Green
} else {
    Write-Host "  [INFO] MongoDB service is not running. Development and staging can use the embedded fallback; the Electron production build includes MongoDB." -ForegroundColor Cyan
}

Write-Host "[3/5] Creating environment files..." -ForegroundColor Yellow
$sharedEnvironmentPath = Join-Path $rootDir ".env"
if (-not (Test-Path $sharedEnvironmentPath)) {
    Copy-Item -LiteralPath (Join-Path $rootDir ".env.example") -Destination $sharedEnvironmentPath
    Write-Host "  [OK] Created shared .env settings." -ForegroundColor Green
}

foreach ($environment in @("development", "staging", "production")) {
    $environmentPath = Join-Path $rootDir ".env.$environment"
    if (Test-Path $environmentPath) {
        Write-Host "  [OK] Preserved .env.$environment." -ForegroundColor Green
        continue
    }

    $randomBytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($randomBytes)
    $rng.Dispose()
    $jwtSecret = ($randomBytes | ForEach-Object { "{0:x2}" -f $_ }) -join ""
    $examplePath = Join-Path $rootDir ".env.$environment.example"
    $environmentContent = Get-Content -LiteralPath $examplePath -Raw
    $environmentContent = $environmentContent -replace '(?m)^JWT_SECRET=.*$', "JWT_SECRET=$jwtSecret"
    Set-Content -LiteralPath $environmentPath -Value $environmentContent -Encoding UTF8
    Write-Host "  [OK] Created .env.$environment with a unique JWT secret." -ForegroundColor Green
}

Write-Host "[4/5] Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "[5/5] Initializing the development database..." -ForegroundColor Yellow
$env:APP_ENV = "development"
$env:NODE_ENV = "development"
try {
    node backend/scripts/seed.js
    Write-Host "  [OK] Development database initialized." -ForegroundColor Green
} catch {
    Write-Warning "Development database seeding could not complete: $_"
}

Write-Host ""
Write-Host "Setup complete." -ForegroundColor Green
Write-Host "  Development: npm run start:development (LAN port 9090)" -ForegroundColor Cyan
Write-Host "  Staging:     npm run start:staging     (LAN port 7039)" -ForegroundColor Cyan
Write-Host "  Production:  npm run start:production  (LAN port 2000)" -ForegroundColor Cyan
Write-Host "  Desktop EXE: powershell -ExecutionPolicy Bypass -File scripts/build-exe.ps1" -ForegroundColor Cyan
