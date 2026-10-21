# ==============================================================================
# Raisoni Software Demo - Database Backup Utility
# Creates timestamped database archives into the data/backups/ folder
# without ever deleting or overwriting past backups.
# ==============================================================================

$ErrorActionPreference = "Stop"

$rootDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $rootDir

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Raisoni Software Demo -- Database Backup Manager" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$backupDir = Join-Path $rootDir "data\backups"
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$archiveFile = Join-Path $backupDir "raisoni_backup_$timestamp.archive"

Write-Host "Checking for native MongoDB mongodump binary..." -ForegroundColor Yellow
$mongodumpCmd = Get-Command "mongodump" -ErrorAction SilentlyContinue

if ($mongodumpCmd) {
    Write-Host "Found mongodump: $($mongodumpCmd.Source)" -ForegroundColor Green
    Write-Host "Creating mongodump archive at: $archiveFile" -ForegroundColor Cyan
    & mongodump --uri="mongodb://127.0.0.1:27017/raisoni_software_demo" --archive="$archiveFile" --gzip
    if ($LASTEXITCODE -eq 0 -and (Test-Path $archiveFile)) {
        $fileSize = (Get-Item $archiveFile).Length
        Write-Host "Backup Completed Successfully!" -ForegroundColor Green
        Write-Host "Location:  $archiveFile" -ForegroundColor White
        Write-Host "File Size: $([math]::Round($fileSize / 1KB, 2)) KB" -ForegroundColor White
    }
} else {
    Write-Host "Notice: 'mongodump' not in PATH. Running snapshot export via backend service..." -ForegroundColor Cyan
    node backend/scripts/backup.js
}

Write-Host ""
Write-Host "Backups in data/backups/ are safely preserved." -ForegroundColor Gray
Write-Host ""
