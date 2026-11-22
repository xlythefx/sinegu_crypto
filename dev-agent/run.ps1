# Start the Pixel Alpha developer agent in the background, logging to ~/.devagent/agent.log.
# Registered to run at logon by install-task.ps1; safe to run by hand (one copy only: agent.lock).
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$work = Join-Path $env:USERPROFILE '.devagent'
New-Item -ItemType Directory -Force $work | Out-Null
$python = (Get-Command python).Source
Start-Process -FilePath $python -ArgumentList "-u", "`"$here\agent.py`"" -WindowStyle Hidden `
  -RedirectStandardOutput (Join-Path $work 'agent.log') -RedirectStandardError (Join-Path $work 'agent.err.log')
