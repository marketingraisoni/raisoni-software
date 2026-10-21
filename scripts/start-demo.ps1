# ==============================================================================
# Raisoni Software Demo - Desktop Application Launcher
# Supports Mode A (Single-PC demo with local backend) and
# Mode B (LAN Client connecting to central server without local backend).
# ==============================================================================

param (
    [switch]$ClientOnly = $false
)

$rootDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $rootDir

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Raisoni Software Demo -- Desktop Launcher" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# Ensure frontend is built
$distHtml = Join-Path $rootDir "frontend\dist\index.html"
if (-not (Test-Path $distHtml)) {
    Write-Host "Building production frontend bundle first..." -ForegroundColor Yellow
    npm run frontend:build
}

$backendJob = $null

if (-not $ClientOnly) {
    # Check if a backend server is already running on port 3000
    $isPortOpen = $false
    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $asyncResult = $tcpClient.BeginConnect("127.0.0.1", 3000, $null, $null)
        $success = $asyncResult.AsyncWaitHandle.WaitOne(500, $false)
        if ($success -and $tcpClient.Connected) {
            $isPortOpen = $true
            $tcpClient.EndConnect($asyncResult)
        }
        $tcpClient.Close()
    } catch {
        $isPortOpen = $false
    }

    if ($isPortOpen) {
        Write-Host "[OK] Backend server is already running on port 3000 (avoiding duplicate process)." -ForegroundColor Green
    } else {
        Write-Host "Starting local background Node.js server for single-PC mode..." -ForegroundColor Cyan
        $backendJob = Start-Job -ScriptBlock {
            param($path)
            Set-Location $path
            node backend/server.js
        } -ArgumentList $rootDir

        Start-Sleep -Seconds 2
    }
} else {
    Write-Host "Running in Client-Only Mode (Connecting to central LAN server)." -ForegroundColor Cyan
}

Write-Host "Launching Electron Desktop Window..." -ForegroundColor Green
try {
    npx electron desktop/main.cjs
} finally {
    if ($backendJob) {
        Write-Host "Stopping local background backend server..." -ForegroundColor Gray
        Stop-Job $backendJob -ErrorAction SilentlyContinue
        Remove-Job $backendJob -ErrorAction SilentlyContinue
    }
}
