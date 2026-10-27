param (
    [ValidateSet("development", "staging", "production")]
    [string]$Environment = "production"
)

$ErrorActionPreference = "Stop"
$rootDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $rootDir

$ports = @{
    development = 9090
    staging = 7039
    production = 2000
}
$port = $ports[$Environment]

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Raisoni ERP -- $Environment LAN Server" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan

try {
    $null = (node -v).Trim()
} catch {
    Write-Error "Node.js not found. Please run scripts/setup.ps1 first."
    exit 1
}

$environmentFile = Join-Path $rootDir ".env.$Environment"
$environmentExample = Join-Path $rootDir ".env.$Environment.example"
if (-not (Test-Path $environmentFile)) {
    Write-Warning "$environmentFile was not found; creating it from the example. Replace its JWT_SECRET before shared use."
    Copy-Item -LiteralPath $environmentExample -Destination $environmentFile
}

Write-Host "Environment: $Environment" -ForegroundColor Yellow
Write-Host "Static port: $port" -ForegroundColor Yellow
Write-Host "Database: raisoni_software_$Environment" -ForegroundColor Yellow

$localIps = Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Wi-Fi*", "Ethernet*", "Local*" -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" }

Write-Host ""
if ($localIps) {
    Write-Host "Open the following address on any PC connected to this LAN:" -ForegroundColor Green
    foreach ($ip in $localIps) {
        Write-Host "  http://$($ip.IPAddress):$port" -ForegroundColor White
    }
} else {
    Write-Host "Local address: http://127.0.0.1:$port" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Press Ctrl+C to stop the server." -ForegroundColor Gray
$env:APP_ENV = $Environment
$env:NODE_ENV = if ($Environment -eq "development") { "development" } else { "production" }
node backend/server.js
