# Start the developer agent every time Christian logs in (Task Scheduler, current user only).
# Remove with:  Unregister-ScheduledTask -TaskName 'PixelAlphaDevAgent' -Confirm:$false
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$here\run.ps1`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
Register-ScheduledTask -TaskName 'PixelAlphaDevAgent' -Action $action -Trigger $trigger `
  -Description 'Pixel Alpha developer agent (dev-agent/agent.py)' -Force | Out-Null
Write-Host 'Registered: PixelAlphaDevAgent starts at logon.'
