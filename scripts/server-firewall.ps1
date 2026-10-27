# Allows other LAN PCs (and the desktop app) to reach the production server.
#   TCP 2000  - the app and API
#   UDP 47800 - LAN discovery, so desktop apps find this server without a configured IP
# Without these rules Windows Firewall silently blocks other PCs.
#
# Run on the server PC from an Administrator PowerShell (safe to run again):
#   npm run server:firewall
param (
    [int]$Port = 2000,
    [int]$DiscoveryPort = 47800
)

$ErrorActionPreference = "Stop"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "Run this from an Administrator PowerShell (right-click PowerShell > Run as administrator)."
    exit 1
}

$rules = @(
    @{ Name = "Raisoni ERP Server (TCP $Port)"; Protocol = "TCP"; Port = $Port },
    @{ Name = "Raisoni ERP Discovery (UDP $DiscoveryPort)"; Protocol = "UDP"; Port = $DiscoveryPort }
)

foreach ($rule in $rules) {
    if (Get-NetFirewallRule -DisplayName $rule.Name -ErrorAction SilentlyContinue) {
        Write-Host "Firewall rule '$($rule.Name)' already exists." -ForegroundColor Green
        continue
    }
    New-NetFirewallRule -DisplayName $rule.Name -Direction Inbound -Protocol $rule.Protocol `
        -LocalPort $rule.Port -Action Allow -Profile Any | Out-Null
    Write-Host "Created firewall rule '$($rule.Name)'." -ForegroundColor Green
}

Write-Host "Other PCs can now open http://<this-pc-ip>:$Port and the desktop app can find this server." -ForegroundColor Cyan
