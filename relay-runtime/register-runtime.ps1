$ErrorActionPreference = 'Stop'
$relayTaskName = 'Classroom-Olimpia-Relay-1010'
$relayUser = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$relayScript = 'D:\Documents\CODEX\2026-11-18\em-check-xem-tr-n-wep\outputs\classroom-relay\launch-supervisor.ps1'
$relayAction = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $relayScript + '"')
$relayTrigger = New-ScheduledTaskTrigger -AtLogOn -User $relayUser
$relayPrincipal = New-ScheduledTaskPrincipal -UserId $relayUser -LogonType Interactive -RunLevel Limited
$relaySettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $relayTaskName -Action $relayAction -Trigger $relayTrigger -Principal $relayPrincipal -Settings $relaySettings -Description 'Keep the authorized classroom 1010 HTTPS relay running and recover its endpoint after tunnel restart.' -Force | Out-Null
Start-ScheduledTask -TaskName $relayTaskName
Get-ScheduledTask -TaskName $relayTaskName | Select-Object TaskName,State | ConvertTo-Json -Compress
