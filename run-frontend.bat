@echo off
setlocal
cd /d "%~dp0frontend"

powershell -NoProfile -Command "$conn = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if (-not $conn) { exit 0 }; $p = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $conn.OwningProcess) -ErrorAction SilentlyContinue; if ($p -and $p.CommandLine -match 'vite') { Write-Host 'Frontend is already running on http://localhost:5173/'; exit 10 } else { Write-Host ('Port 5173 is already in use by PID ' + $conn.OwningProcess + '.'); Write-Host 'Close that process and run this script again.'; exit 11 }"
if errorlevel 11 exit /b 1
if errorlevel 10 exit /b 0

call npm install
call npm run dev -- --host 0.0.0.0
