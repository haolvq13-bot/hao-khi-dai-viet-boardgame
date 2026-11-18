$ErrorActionPreference = 'Stop'
$relayRuntime = $PSScriptRoot
$relayNode = 'C:\Program Files\nodejs\node.exe'
$relaySupervisor = Join-Path $relayRuntime 'supervisor.cjs'
$relayLaunch = Start-Process -FilePath $relayNode -ArgumentList @('"' + $relaySupervisor + '"') -WorkingDirectory $relayRuntime -WindowStyle Hidden -Wait -PassThru -RedirectStandardOutput (Join-Path $relayRuntime 'supervisor.stdout.log') -RedirectStandardError (Join-Path $relayRuntime 'supervisor.stderr.log')
exit $relayLaunch.ExitCode
