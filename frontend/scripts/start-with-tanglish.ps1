$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path $PSScriptRoot -Parent
$backendProject = Resolve-Path (Join-Path $repoRoot '..\backend\python-service')
$backendUrl = 'http://127.0.0.1:8000/api/health'
$venvPython = Join-Path $backendProject '.venv\Scripts\python.exe'
$pythonExe = if (Test-Path $venvPython) { $venvPython } else { 'python' }

function Test-PythonBackend {
  try {
    $response = Invoke-WebRequest -Uri $backendUrl -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

if (-not (Test-PythonBackend)) {
  Write-Host 'Starting Python backend on http://127.0.0.1:8000 ...'

  Start-Process `
    -FilePath $pythonExe `
    -ArgumentList @('-m', 'uvicorn', 'app.main:socket_app', '--host', '127.0.0.1', '--port', '8000') `
    -WorkingDirectory $backendProject `
    -WindowStyle Hidden | Out-Null

  $started = $false
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    Start-Sleep -Milliseconds 750
    if (Test-PythonBackend) {
      $started = $true
      break
    }
  }

  if (-not $started) {
    throw 'Python backend did not start on http://127.0.0.1:8000 within the expected time.'
  }
}

Write-Host 'Python backend is ready. Starting Angular dev server...'
& (Join-Path $repoRoot 'node_modules\.bin\ng.cmd') serve
