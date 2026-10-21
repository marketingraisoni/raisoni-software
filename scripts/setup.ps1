# ==============================================================================
# Raisoni Software Demo - Project Setup Script
# Checks system prerequisites, installs dependencies, initializes environment,
# and seeds demo records into MongoDB.
# ==============================================================================

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Raisoni Software Demo -- Automated Environment Setup" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check Operating System
if ($PSVersionTable.Platform -and $PSVersionTable.Platform -ne "Win32NT") {
    Write-Warning "Non-Windows environment detected. Some desktop features are optimized for Windows."
}

# 2. Check Node.js and npm
Write-Host "[1/5] Checking Node.js and npm prerequisites..." -ForegroundColor Yellow
try {
    $nodeVersion = (node -v).Trim()
    $npmVersion = (npm -v).Trim()
    Write-Host "  [OK] Node.js installed: $nodeVersion" -ForegroundColor Green
    Write-Host "  [OK] npm installed:     $npmVersion" -ForegroundColor Green
} catch {
    Write-Error "Node.js is not installed or not available in PATH. Please install Node.js 18+ from https://nodejs.org/"
    exit 1
}

# 3. Check MongoDB Community Server
Write-Host ""
Write-Host "[2/5] Checking local MongoDB Community Server status..." -ForegroundColor Yellow
$mongoRunning = $false
try {
    $mongoService = Get-Service -Name "MongoDB" -ErrorAction SilentlyContinue
    if ($mongoService -and $mongoService.Status -eq "Running") {
        Write-Host "  [OK] MongoDB Windows service is actively running." -ForegroundColor Green
        $mongoRunning = $true
    } elseif ($mongoService) {
        Write-Host "  [WARN] MongoDB Windows service found but currently stopped." -ForegroundColor Yellow
    }
} catch {
    # Service query error or non-admin
}

if (-not $mongoRunning) {
    Write-Host "  [INFO] Notice: Local MongoDB service was not detected in Windows Services." -ForegroundColor Cyan
    Write-Host "    The demo includes automatic embedded in-memory database fallback so you" -ForegroundColor Gray
    Write-Host "    can test and evaluate immediately without installing MongoDB manually." -ForegroundColor Gray
    Write-Host "    For persistent production database storage, download MongoDB Community Server:" -ForegroundColor Gray
    Write-Host "    https://www.mongodb.com/try/download/community" -ForegroundColor Gray
}

# 4. Initialize .env file safely
Write-Host ""
Write-Host "[3/5] Checking environment configuration (.env)..." -ForegroundColor Yellow
$envPath = Join-Path $PSScriptRoot "..\.env"
$envExamplePath = Join-Path $PSScriptRoot "..\.env.example"

if (-not (Test-Path $envPath)) {
    Write-Host "  Creating new .env file with secure randomized cryptographic keys..." -ForegroundColor Cyan
    $randomBytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($randomBytes)
    $jwtSecret = ($randomBytes | ForEach-Object { "{0:x2}" -f $_ }) -join ""

    $envContent = @"
# Server Network Configuration
PORT=3000
HOST=0.0.0.0
NODE_ENV=development

# Database Connection
MONGODB_URI=mongodb://127.0.0.1:27017/raisoni_software_demo
USE_EMBEDDED_MONGODB_FALLBACK=true

# Security Key
JWT_SECRET=$jwtSecret
JWT_EXPIRES_IN=8h

CORS_ORIGIN=*
APP_NAME=Raisoni Software Demo
APP_VERSION=1.0.0
"@
    Set-Content -Path $envPath -Value $envContent -Encoding UTF8
    Write-Host "  [OK] Generated .env with secure random JWT_SECRET." -ForegroundColor Green
} else {
    Write-Host "  [OK] Existing .env file found (preserved existing secrets)." -ForegroundColor Green
}

# 5. Install Dependencies
Write-Host ""
Write-Host "[4/5] Installing project dependencies via npm..." -ForegroundColor Yellow
$rootDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Push-Location $rootDir
try {
    npm install
    if ($LASTEXITCODE -ne 0) {
        throw "npm install exited with error code $LASTEXITCODE"
    }
    Write-Host "  [OK] Dependencies installed successfully." -ForegroundColor Green
} finally {
    Pop-Location
}

# 6. Database Seeding Confirmation
Write-Host ""
Write-Host "[5/5] Database Demo Records Initialization..." -ForegroundColor Yellow
Push-Location $rootDir
try {
    node backend/scripts/seed.js
    Write-Host "  [OK] Database successfully initialized with demo records." -ForegroundColor Green
} catch {
    Write-Warning "Database seeding encountered an issue: $_"
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host " Setup Complete! You can now start the software:" -ForegroundColor White
Write-Host "  - To start backend server:  ./scripts/start-server.ps1" -ForegroundColor Cyan
Write-Host "  - To launch desktop demo:   ./scripts/start-demo.ps1" -ForegroundColor Cyan
Write-Host "  - To build Windows EXE:     ./scripts/build-exe.ps1" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Green
