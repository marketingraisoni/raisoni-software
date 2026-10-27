# Registers a Windows Scheduled Task that restores the saved PM2 process list
# ("pm2 save") whenever this user logs on. `pm2 startup` does not support Windows.
#
# Usage:   npm run pm2:autostart            (register / update)
#          npm run pm2:autostart -- -Remove (unregister)
param (
    [switch]$Remove
)

$ErrorActionPreference = "Stop"
$rootDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$taskName = "Raisoni ERP - PM2 Resurrect"

if ($Remove) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "Removed scheduled task '$taskName'." -ForegroundColor Green
    exit 0
}

$pm2 = Join-Path $rootDir "node_modules\.bin\pm2.cmd"
if (-not (Test-Path $pm2)) {
    Write-Error "PM2 not found at $pm2. Run 'npm install' in $rootDir first."
    exit 1
}

# Logon trigger (not startup) so mapped network drives and the user's PM2_HOME are available.
# The delay gives the network and the MongoDB service time to come up.
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"`"$pm2`" resurrect`"" -WorkingDirectory $rootDir
$trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$trigger.Delay = "PT30S"
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 5)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null

Write-Host "Registered scheduled task '$taskName'." -ForegroundColor Green
Write-Host "PM2 will restore the processes saved with 'pm2 save' each time $env:USERNAME logs on." -ForegroundColor Cyan
Write-Host "Make sure the backend is running and saved first: npm run pm2:start" -ForegroundColor Cyan
