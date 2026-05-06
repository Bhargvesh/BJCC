@echo off
title BJCC — Expo Metro (ANY Network)
color 0B
cd /d "%~dp0"

echo.
echo  =====================================================
echo   BJCC Mobile ^| Works on ANY WiFi or Mobile Data
echo  =====================================================
echo.

:: Clean old URL file
if exist metro-tunnel-url.txt del metro-tunnel-url.txt

:: Start localtunnel for Metro in a new window
echo  [1/3] Starting public Metro tunnel (localtunnel)...
start "BJCC-Metro-Tunnel" cmd /c "npx localtunnel --port 8081 > metro-tunnel-url.txt 2>&1"

:: Wait for tunnel to establish
echo  [2/3] Waiting 12 seconds for tunnel...
timeout /t 12 /nobreak > nul

:: Extract the tunnel URL from the output file
for /f "delims=" %%i in ('powershell -NoProfile -Command "if (Test-Path metro-tunnel-url.txt) { Get-Content metro-tunnel-url.txt | ForEach-Object { if ($_ -match 'your url is: (https://\S+)') { $matches[1] } } | Select-Object -First 1 }"') do set METRO_URL=%%i

:: Retry once if empty
if "%METRO_URL%"=="" (
    echo  Retrying tunnel detection...
    timeout /t 6 /nobreak > nul
    for /f "delims=" %%i in ('powershell -NoProfile -Command "if (Test-Path metro-tunnel-url.txt) { Get-Content metro-tunnel-url.txt | ForEach-Object { if ($_ -match 'your url is: (https://\S+)') { $matches[1] } } | Select-Object -First 1 }"') do set METRO_URL=%%i
)

if "%METRO_URL%"=="" (
    echo.
    echo  ERROR: Tunnel failed. Falling back to LAN mode.
    echo  (Requires same WiFi as PC)
    echo.
    cd /d "%~dp0mobile"
    npx expo start --clear
    goto :EOF
)

:: Extract hostname only (remove https://)
for /f "tokens=2 delims=/" %%i in ("%METRO_URL%") do set METRO_HOST=%%i

echo.
echo  =====================================================
echo   Metro Tunnel: %METRO_URL%
echo  =====================================================
echo.
echo  [3/3] Starting Expo...
echo.
echo  STEP 1: Open %METRO_URL% in your phone browser once
echo          and click "Click to Continue" if prompted.
echo  STEP 2: Then scan the QR code below with Expo Go.
echo  =====================================================
echo.

cd /d "%~dp0mobile"
set REACT_NATIVE_PACKAGER_HOSTNAME=%METRO_HOST%
npx expo start --clear
