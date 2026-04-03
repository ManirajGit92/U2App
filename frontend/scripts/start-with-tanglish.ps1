$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path $PSScriptRoot -Parent
$backendProject = Join-Path $repoRoot '..\backend\tanglish-api'
$backendUrl = 'http://127.0.0.1:5199/'
$dotnetCliHome = Join-Path $repoRoot '.dotnet'

if (-not (Test-Path $dotnetCliHome)) {
  New-Item -ItemType Directory -Path $dotnetCliHome | Out-Null
}

function Test-TanglishApi {
  try {
    $response = Invoke-WebRequest -Uri $backendUrl -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

if (-not (Test-TanglishApi)) {
  Write-Host 'Starting Tanglish API on http://127.0.0.1:5199 ...'

  $backendCommand = '$env:DOTNET_CLI_HOME="' + $dotnetCliHome + '"; dotnet run --project "' + $backendProject + '" --urls http://127.0.0.1:5199'

  Start-Process `
    -FilePath 'powershell' `
    -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $backendCommand) `
    -WorkingDirectory $backendProject `
    -WindowStyle Hidden | Out-Null

  $started = $false
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    Start-Sleep -Milliseconds 750
    if (Test-TanglishApi) {
      $started = $true
      break
    }
  }

  if (-not $started) {
    throw 'Tanglish API did not start on http://127.0.0.1:5199 within the expected time.'
  }
}

Write-Host 'Tanglish API is ready. Starting Angular dev server...'
& (Join-Path $repoRoot 'node_modules\.bin\ng.cmd') serve
