# Creates (or updates) the Windows task that runs get-reports.ps1 every day at 07:30,
# or as soon as the computer is on if it was off at 07:30. Then runs it once now.
$script = Join-Path $PSScriptRoot 'get-reports.ps1'
$a = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $script + '"')
$t = New-ScheduledTaskTrigger -Daily -At '07:30'
$s = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
Register-ScheduledTask -TaskName 'LWEC daily reports download' -Action $a -Trigger $t -Settings $s -Force | Out-Null
& $script
Write-Host ''
Write-Host 'Done. The reports will be saved here every morning.' -ForegroundColor Green
Get-Content (Join-Path $PSScriptRoot 'download-log.txt') -Tail 1
