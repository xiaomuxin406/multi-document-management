param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pythonPath = Join-Path $projectRoot '.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $pythonPath)) { throw 'Run ./scripts/setup.ps1 first.' }
foreach ($port in @(8000, 5173)) {
    if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) {
        throw "Port $port is already in use. Stop that process or use the manual startup commands in README.md."
    }
}
$backendProcess = $null
$frontendProcess = $null
try {
    $backendProcess = Start-Process -FilePath $pythonPath -ArgumentList @('-m','uvicorn','app.main:app','--app-dir','backend','--host','127.0.0.1','--port','8000') -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $projectRoot 'backend.stdout.log') -RedirectStandardError (Join-Path $projectRoot 'backend.stderr.log')
    $vitePath = Join-Path $projectRoot 'frontend/node_modules/vite/bin/vite.js'
    $frontendProcess = Start-Process -FilePath 'node' -ArgumentList @(('"' + $vitePath + '"'),'--host','127.0.0.1','--port','5173','--strictPort') -WorkingDirectory (Join-Path $projectRoot 'frontend') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $projectRoot 'frontend.stdout.log') -RedirectStandardError (Join-Path $projectRoot 'frontend.stderr.log')
    $ready = $false
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        Start-Sleep -Milliseconds 500
        if ($backendProcess.HasExited -or $frontendProcess.HasExited) { throw 'A server stopped. See *.stderr.log.' }
        try {
            $health = Invoke-RestMethod -Uri 'http://127.0.0.1:5173/api/health' -TimeoutSec 2
            if ($health.status -eq 'ok') { $ready = $true; break }
        } catch { }
    }
    if (-not $ready) { throw 'Server startup timed out. See *.stderr.log.' }
    Write-Host 'Research Workspace: http://127.0.0.1:5173'
    Write-Host 'API documentation: http://127.0.0.1:8000/docs'
    Write-Host 'Press Ctrl+C to stop both servers.'
    if (-not $NoBrowser) { Start-Process 'http://127.0.0.1:5173' -WindowStyle Hidden }
    while (-not $backendProcess.HasExited -and -not $frontendProcess.HasExited) {
        Start-Sleep -Seconds 1
    }
} finally {
    foreach ($serverProcess in @($backendProcess, $frontendProcess)) {
        if ($null -ne $serverProcess -and -not $serverProcess.HasExited) {
            Stop-Process -Id $serverProcess.Id -ErrorAction SilentlyContinue
        }
    }
}
