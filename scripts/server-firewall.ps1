# Allows other LAN PCs (and the desktop app) to reach the production server on port 2000.
# Without this rule Windows Firewall silently blocks them and they see "connection refused".
#
# Run once on the server PC from an Administrator PowerShell:
#   npm run server:firewall
param (
    [int]$Port = 2000
)

$ErrorActionPreference = "Stop"
$ruleName = "Raisoni ERP Server (TCP $Port)"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "Run this from an Administrator PowerShell (right-click PowerShell > Run as administrator)."
    exit 1
}

if (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue) {
    Write-Host "Firewall rule '$ruleName' already exists." -ForegroundColor Green
    exit 0
}

New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Any | Out-Null
Write-Host "Created firewall rule '$ruleName'. Other PCs can now open http://<this-pc-ip>:$Port" -ForegroundColor Green
