# ==============================================================================
# Raisoni ERP - Network & LAN Diagnostics Script
# Tests API endpoint reachability, inspects host interfaces, and diagnoses
# common Wi-Fi isolation and Windows Firewall misconfigurations.
# ==============================================================================

param (
    [string]$TargetUrl = "http://127.0.0.1:2000/api"
)

$ErrorActionPreference = "Continue"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Raisoni ERP -- Network Diagnostics Tool" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Testing Target Endpoint: $TargetUrl" -ForegroundColor Yellow

$cleanTarget = $TargetUrl.TrimEnd("/")
if (-not $cleanTarget.EndsWith("/api")) {
    $cleanTarget = "$cleanTarget/api"
}
$healthEndpoint = "$cleanTarget/health"

# 1. Ping / HTTP Probe
$probeSuccess = $false
try {
    Write-Host "Sending HTTP GET probe to: $healthEndpoint (timeout 4s)..." -ForegroundColor Gray
    $res = Invoke-RestMethod -Uri $healthEndpoint -Method Get -TimeoutSec 4 -ErrorAction Stop
    Write-Host ""
    Write-Host "[OK] Connection Succeeded!" -ForegroundColor Green
    Write-Host "  Application Name: $($res.appName) (v$($res.version))" -ForegroundColor White
    Write-Host "  Database Status:  $($res.database.status) (Connected: $($res.database.connected))" -ForegroundColor White
    Write-Host "  Server Primary IP: $($res.primaryLanIp)" -ForegroundColor White
    $probeSuccess = $true
} catch {
    Write-Host ""
    Write-Host "[ERROR] Probe Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# 2. Local Interfaces Overview
Write-Host ""
Write-Host "Local Network Adapters on this Computer:" -ForegroundColor Yellow
$adapters = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" }

foreach ($ad in $adapters) {
    Write-Host "  - Interface: $($ad.InterfaceAlias)" -ForegroundColor Cyan
    Write-Host "    IPv4:      $($ad.IPAddress)" -ForegroundColor White
}

# 3. Troubleshooting Guidance if connection failed
if (-not $probeSuccess) {
    Write-Host ""
    Write-Host "----------------------------------------------------------" -ForegroundColor Yellow
    Write-Host " Common Causes and Troubleshooting Recommendations:" -ForegroundColor White
    Write-Host "----------------------------------------------------------" -ForegroundColor Yellow
    Write-Host "1. Is the Central Server running? Ensure the server host PC has run './scripts/start-server.ps1'." -ForegroundColor Gray
    Write-Host "2. Windows Firewall: On the Server PC, ensure incoming TCP Port 2000 is allowed:" -ForegroundColor Gray
    Write-Host "   New-NetFirewallRule -DisplayName 'Raisoni ERP Server' -Direction Inbound -LocalPort 2000 -Protocol TCP -Action Allow" -ForegroundColor Gray
    Write-Host "3. Windows Network Profile: Change Wi-Fi connection from 'Public' to 'Private' on both PCs." -ForegroundColor Gray
    Write-Host "4. Wi-Fi Router AP Isolation: Some office/guest Wi-Fi routers prevent client-to-client traffic." -ForegroundColor Gray
    Write-Host "   Ensure 'AP Isolation' / 'Client Isolation' is turned OFF in your Wi-Fi router settings." -ForegroundColor Gray
}

Write-Host ""
