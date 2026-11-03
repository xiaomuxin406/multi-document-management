$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
foreach ($port in @(8001,5174)) {
    if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) { throw "Test port $port is already in use." }
}
$previous = @{}
foreach ($name in @('DATA_DIR','DATABASE_URL','TRUSTED_ORIGINS','VITE_API_TARGET','E2E_BASE_URL','LLM_API_KEY','TAVILY_API_KEY','EMBEDDING_MODEL')) {
    $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}
$backendProcess = $null
$frontendProcess = $null
try {
    $env:DATA_DIR = Join-Path $projectRoot ('data/e2e/' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $env:DATA_DIR -Force | Out-Null
    $env:DATABASE_URL = 'sqlite:///' + (Join-Path $env:DATA_DIR 'test.db').Replace('\','/')
    $env:TRUSTED_ORIGINS = 'http://127.0.0.1:5174'
    $env:VITE_API_TARGET = 'http://127.0.0.1:8001'
    $env:E2E_BASE_URL = 'http://127.0.0.1:5174'
    $env:LLM_API_KEY = ''
    $env:TAVILY_API_KEY = ''
    $env:EMBEDDING_MODEL = ''
    $pythonPath = Join-Path $projectRoot '.venv/Scripts/python.exe'
    $backendProcess = Start-Process -FilePath $pythonPath -ArgumentList @('-m','uvicorn','app.main:app','--app-dir','backend','--host','127.0.0.1','--port','8001') -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $env:DATA_DIR 'backend.stdout.log') -RedirectStandardError (Join-Path $env:DATA_DIR 'backend.stderr.log')
    $vitePath = Join-Path $projectRoot 'frontend/node_modules/vite/bin/vite.js'
    $frontendProcess = Start-Process -FilePath 'node' -ArgumentList @(('"' + $vitePath + '"'),'--host','127.0.0.1','--port','5174','--strictPort') -WorkingDirectory (Join-Path $projectRoot 'frontend') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $env:DATA_DIR 'frontend.stdout.log') -RedirectStandardError (Join-Path $env:DATA_DIR 'frontend.stderr.log')
    $ready = $false
    for ($attempt = 0; $attempt -lt 50; $attempt++) {
        Start-Sleep -Milliseconds 500
        if ($backendProcess.HasExited -or $frontendProcess.HasExited) { throw 'Test server failed. Inspect data/e2e logs.' }
        try { if ((Invoke-RestMethod 'http://127.0.0.1:5174/api/health' -TimeoutSec 2).status -eq 'ok') { $ready = $true; break } } catch { }
    }
    if (-not $ready) { throw 'Test servers timed out.' }
    Push-Location -LiteralPath 'frontend'
    try {
        npx.cmd playwright test
        if ($LASTEXITCODE -ne 0) { throw 'Browser verification failed.' }
    } finally { Pop-Location }
} finally {
    foreach ($serverProcess in @($backendProcess,$frontendProcess)) {
        if ($null -ne $serverProcess -and -not $serverProcess.HasExited) { Stop-Process -Id $serverProcess.Id -ErrorAction SilentlyContinue }
    }
    foreach ($name in $previous.Keys) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
}
