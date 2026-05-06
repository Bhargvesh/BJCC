@echo off
title BJCC — Backend Tunnel (ngrok)
color 0A
echo.
echo  =====================================================
echo   BJCC BACKEND TUNNEL — Works on ANY Network!
echo  =====================================================
echo.
echo  Backend URL: https://marxism-sulfite-remedial.ngrok-free.dev
echo.
echo  Keep this window OPEN. Press Ctrl+C to stop.
echo  =====================================================
echo.

set NGROK_PATH=%LOCALAPPDATA%\Microsoft\WinGet\Packages\Ngrok.Ngrok_Microsoft.Winget.Source_8wekyb3d8bbwe\ngrok.exe

"%NGROK_PATH%" http 8010 --url=marxism-sulfite-remedial.ngrok-free.dev

pause
