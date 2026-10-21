# ==============================================================================
# Raisoni Software Demo - Server Launch Script
# Starts the backend REST API & Socket.IO server on the local machine
# and reports local and Wi-Fi LAN IP endpoints for client PC connections.
# ==============================================================================

$ErrorActionPreference = "Stop"

$rootDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $rootDir

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Raisoni Software Demo -- Central Server Startup" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# Verify node exists
try {
    $nodeVer = (node -v).Trim()
} catch {
    Write-Error "Node.js not found. Please run ./scripts/setup.ps1 first."
    exit 1
}

# Check .env existence
$envPath = Join-Path $rootDir ".env"
if (-not (Test-Path $envPath)) {
    Write-Warning "Configuration file .env was not found. Copying from .env.example..."
    Copy-Item (Join-Path $rootDir ".env.example") $envPath
}

# Determine host IPv4 addresses on local network
Write-Host "Detecting local network interfaces..." -ForegroundColor Yellow
$localIps = Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Wi-Fi*", "Ethernet*", "Local*" -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" }

if ($localIps) {
    Write-Host ""
    Write-Host "  Designated Server LAN Addresses for Client PCs:" -ForegroundColor Green
    foreach ($ip in $localIps) {
        Write-Host "    -> http://$($ip.IPAddress):3000/api  ($($ip.InterfaceAlias))" -ForegroundColor White
    }
} else {
    Write-Host "  -> Local Loopback: http://127.0.0.1:3000/api" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Starting Node.js Backend Server..." -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the server at any time." -ForegroundColor Gray
Write-Host ""

node backend/server.js
