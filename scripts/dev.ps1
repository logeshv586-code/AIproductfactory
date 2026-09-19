# AI Product Factory - Local Development Startup Script (Windows PowerShell)

$ErrorActionPreference = "Stop"

# Resolve repository root dynamically relative to script location
$RepoRoot = Split-Path -Parent $PSScriptRoot

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "      AI Product Factory - Local Dev Server       " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Repository root: $RepoRoot"

# Check for npm
$NpmCmd = Get-Command npm -ErrorAction SilentlyContinue
if (-not $NpmCmd) {
    Write-Error "[AI Product Factory] Error: 'npm' is required but not found in PATH."
    exit 1
}

# Locate Python executable
$PythonBin = $null
$VenvPy = Join-Path $RepoRoot ".venv\Scripts\python.exe"
$VenvPy2 = Join-Path $RepoRoot "venv\Scripts\python.exe"

if (Test-Path $VenvPy) {
    $PythonBin = $VenvPy
} elseif (Test-Path $VenvPy2) {
    $PythonBin = $VenvPy2
} else {
    $SysPy = Get-Command python.exe -ErrorAction SilentlyContinue
    if (-not $SysPy) {
        $SysPy = Get-Command python -ErrorAction SilentlyContinue
    }
    if ($SysPy) {
        $PythonBin = $SysPy.Source
    }
}

if (-not $PythonBin) {
    Write-Error "[AI Product Factory] Error: Python executable not found. Please set up a Python virtual environment at .venv or install Python."
    exit 1
}

# Verify Python backend directory exists
$BackendEntry = Join-Path $RepoRoot "python-backend\runtime_entry.py"
if (-not (Test-Path $BackendEntry)) {
    Write-Error "[AI Product Factory] Error: Could not find python-backend\runtime_entry.py in $RepoRoot."
    exit 1
}

# Set default ports if not set
$BackendPort = if ($env:PYTHON_BACKEND_PORT) { $env:PYTHON_BACKEND_PORT } else { "8001" }
$FrontendPort = if ($env:PORT) { $env:PORT } else { "3000" }

$env:PYTHON_BACKEND_PORT = $BackendPort

Write-Host "[AI Product Factory] Using Python: $PythonBin"
Write-Host "[AI Product Factory] Starting Python backend on port $BackendPort..."
Write-Host "[AI Product Factory] Starting Next.js Studio on port $FrontendPort..."
Write-Host "==================================================" -ForegroundColor Green
Write-Host "Studio Frontend : http://localhost:$FrontendPort" -ForegroundColor Green
Write-Host "Python Backend  : http://localhost:$BackendPort" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop both servers."
Write-Host ""

$BackendProc = $null
$FrontendProc = $null

try {
    # Start Python backend process
    $BackendProcInfo = New-Object System.Diagnostics.ProcessStartInfo
    $BackendProcInfo.FileName = $PythonBin
    $BackendProcInfo.Arguments = "runtime_entry.py"
    $BackendProcInfo.WorkingDirectory = Join-Path $RepoRoot "python-backend"
    $BackendProcInfo.UseShellExecute = $false

    $BackendProc = [System.Diagnostics.Process]::Start($BackendProcInfo)

    # Start Frontend process via cmd.exe for npm compatibility
    $FrontendProcInfo = New-Object System.Diagnostics.ProcessStartInfo
    $FrontendProcInfo.FileName = "cmd.exe"
    $FrontendProcInfo.Arguments = "/c npm run dev"
    $FrontendProcInfo.WorkingDirectory = $RepoRoot
    $FrontendProcInfo.UseShellExecute = $false

    $FrontendProc = [System.Diagnostics.Process]::Start($FrontendProcInfo)

    # Keep running until Ctrl+C or one process exits
    while (-not $BackendProc.HasExited -and -not $FrontendProc.HasExited) {
        Start-Sleep -Milliseconds 500
    }
} finally {
    Write-Host "`n[AI Product Factory] Shutting down development servers..." -ForegroundColor Yellow
    if ($BackendProc -and -not $BackendProc.HasExited) {
        try { Stop-Process -Id $BackendProc.Id -Force -ErrorAction SilentlyContinue } catch {}
    }
    if ($FrontendProc -and -not $FrontendProc.HasExited) {
        try { Stop-Process -Id $FrontendProc.Id -Force -ErrorAction SilentlyContinue } catch {}
    }
    Write-Host "[AI Product Factory] All servers stopped." -ForegroundColor Green
}
