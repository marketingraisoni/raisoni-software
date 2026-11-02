# Raisoni ERP - Windows Redis Server Setup Helper
# Run this script in an elevated PowerShell prompt (Run as Administrator) to install and start Redis.

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Raisoni ERP -- Windows Redis Server Setup Helper" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Test if Redis is already listening on port 6379
$portOpen = $false
try {
    $client = New-Object System.Net.Sockets.TcpClient
    $iar = $client.BeginConnect("127.0.0.1", 6379, $null, $null)
    $success = $iar.AsyncWaitHandle.WaitOne(1000)
    if ($success) {
        $client.EndConnect($iar)
        $portOpen = $true
    }
    $client.Close()
} catch {}

if ($portOpen) {
    Write-Host "[OK] Redis is already running and reachable on port 6379!" -ForegroundColor Green
    Write-Host "Run 'npm run redis:status' to verify status and latency." -ForegroundColor Cyan
    exit 0
}

# 2. Check if redis service exists
$redisService = Get-Service -Name "Redis", "Memurai" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($redisService) {
    Write-Host "Found $($redisService.Name) service (Status: $($redisService.Status)). Starting service..." -ForegroundColor Yellow
    try {
        Start-Service -Name $redisService.Name
        Write-Host "[OK] $($redisService.Name) service started successfully!" -ForegroundColor Green
        exit 0
    } catch {
        Write-Warning "Could not start service directly: $_. Please run PowerShell as Administrator."
    }
}

# 3. Check for winget to install Redis automatically
Write-Host "Redis is not currently running. Checking winget installer..." -ForegroundColor Yellow
$winget = Get-Command winget -ErrorAction SilentlyContinue

if ($winget) {
    Write-Host "Installing Redis for Windows via winget (Redis.Redis)..." -ForegroundColor Cyan
    Write-Host "This will install Redis as a background Windows service." -ForegroundColor Gray
    
    # winget is a native executable: failures are reported through $LASTEXITCODE, not exceptions.
    winget install --id Redis.Redis -e --accept-source-agreements --accept-package-agreements
    $serviceName = "Redis"
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "winget could not install Redis.Redis (exit code $LASTEXITCODE). Trying Memurai (Redis-compatible for Windows)..."
        winget install --id Memurai.MemuraiDeveloper -e --accept-source-agreements --accept-package-agreements
        $serviceName = "Memurai"
    }

    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Automatic install failed (exit code $LASTEXITCODE). Install Redis manually or use Docker. The backend keeps working with its in-memory fallback."
    } else {
        Start-Sleep -Seconds 3
        try {
            Start-Service -Name $serviceName -ErrorAction Stop
            Write-Host "[OK] $serviceName installed and started. Run 'npm run redis:status' to verify." -ForegroundColor Green
        } catch {
            Write-Warning "$serviceName was installed but its service could not be started: $_. Run PowerShell as Administrator and try 'Start-Service $serviceName'."
        }
    }
} else {
    Write-Host "winget not found. Please install Redis using one of these options:" -ForegroundColor Yellow
    Write-Host " Option A: Download Native Redis MSI: https://github.com/microsoftarchive/redis/releases"
    Write-Host " Option B: Install Memurai for Windows: https://www.memurai.com"
    Write-Host " Option C: Docker: docker run -d -p 6379:6379 redis:alpine"
}

Write-Host "==========================================================" -ForegroundColor Cyan

