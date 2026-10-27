param (
    [ValidateSet("development", "production")]
    [string]$Environment = "production"
)

$ErrorActionPreference = "Stop"
$rootDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $rootDir

$ports = @{
    development = 9090
    production = 2000
}

$env:APP_ENV = $Environment
$env:NODE_ENV = if ($Environment -eq "development") { "development" } else { "production" }

# When the backend is already running with bundled MongoDB, connect through its
# reported loopback port. This avoids opening or copying locked WiredTiger files.
try {
    $health = Invoke-RestMethod `
        -Uri "http://127.0.0.1:$($ports[$Environment])/api/health" `
        -TimeoutSec 3

    if ($health.data.database.connected) {
        $databaseName = [string]$health.data.database.database
        $databasePort = [int]$health.data.database.port
        $env:DATABASE_NAME = $databaseName
        $env:MONGODB_URI = "mongodb://127.0.0.1:$databasePort/$databaseName"
        $env:USE_EMBEDDED_MONGODB = "false"
        $env:USE_EMBEDDED_MONGODB_FALLBACK = "false"

        if ($health.data.database.isEmbedded) {
            $databasePath = [string]$health.data.database.storagePath
            $env:RAISONI_DATA_DIR = Split-Path -Parent $databasePath
        }
    }
} catch {
    Write-Host "Backend health endpoint is not running; using $Environment environment configuration." -ForegroundColor Yellow
}

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCommand) {
    & $nodeCommand.Source "backend/scripts/backup.js"
    $backupExitCode = $LASTEXITCODE
} else {
    $electronNode = Join-Path $rootDir "node_modules\electron\dist\electron.exe"
    if (-not (Test-Path -LiteralPath $electronNode)) {
        throw "Neither Node.js nor the project Electron runtime is available."
    }

    $env:ELECTRON_RUN_AS_NODE = "1"
    $backupProcess = Start-Process `
        -FilePath $electronNode `
        -ArgumentList "backend/scripts/backup.js" `
        -WorkingDirectory $rootDir `
        -NoNewWindow `
        -Wait `
        -PassThru
    $backupExitCode = $backupProcess.ExitCode
}

if ($backupExitCode -ne 0) {
    throw "The $Environment database backup failed with exit code $backupExitCode."
}

Write-Host "$Environment database backup completed and verified." -ForegroundColor Green
