# LWEC Learning Portal: saves the daily reports into this OneDrive folder.
# Run every morning by the Windows task "LWEC daily reports download" (see Switch-on.cmd).
# It fetches what the portal saved at 07:00 and keeps any day it missed (last 60 days):
#   ..\Student monitor\LWEC-student-monitor-US335815-YYYY-MM-DD.csv
#   ..\Staff access log\LWEC-staff-access-log-YYYY-MM-DD.csv
# Files already here are never changed. Results are written to download-log.txt.
$ErrorActionPreference = 'Stop'
$Key  = '__KEY__'
$Url  = 'https://africa-south1-lwec-field-logbook.cloudfunctions.net/monitorReports'
$Root = Split-Path -Parent $PSScriptRoot
$Log  = Join-Path $PSScriptRoot 'download-log.txt'
$H    = @{ 'x-lwec-key' = $Key }
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
try {
  $list = Invoke-RestMethod -Uri ($Url + '?list=1') -Headers $H -TimeoutSec 60 -UseBasicParsing
  $saved = 0
  foreach ($n in @($list)) {
    if ($n -like 'student-monitor/*') { $dir = Join-Path $Root 'Student monitor' } else { $dir = Join-Path $Root 'Staff access log' }
    $file = Join-Path $dir (Split-Path $n -Leaf)
    if (-not (Test-Path -LiteralPath $file)) {
      New-Item -ItemType Directory -Force -Path $dir | Out-Null
      Invoke-WebRequest -Uri ($Url + '?file=' + [uri]::EscapeDataString($n)) -Headers $H -OutFile $file -TimeoutSec 120 -UseBasicParsing
      $saved++
    }
  }
  Add-Content -LiteralPath $Log ((Get-Date -Format 'yyyy-MM-dd HH:mm') + '  OK, ' + $saved + ' new file(s)')
} catch {
  Add-Content -LiteralPath $Log ((Get-Date -Format 'yyyy-MM-dd HH:mm') + '  ERROR: ' + $_.Exception.Message)
}
