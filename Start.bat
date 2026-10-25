@echo off
setlocal EnableExtensions

:: Configurable startup settings.
set "PURO_MAX_HEAP_MB=512"
set "PURO_RESTART_DELAY_SECONDS=5"
set "PURO_AUTO_RESTART=1"

chcp 65001 >nul
cd /d "%~dp0"
title Puro Discord Bot

where node >nul 2>nul
if errorlevel 1 (
    echo Node.js was not found. Install Node.js 26.12.1 or newer.
    pause
    exit /b 1
)
node tools\scripts\runtime.js
if errorlevel 1 (
    echo Puro requires Node.js 26.12.1 or newer.
    pause
    exit /b 1
)
if not exist ".env" (
    copy /y ".env.example" ".env" >nul
    echo Created .env. Fill in TOKEN and clientId, then start Puro again.
    pause
    exit /b 1
)
if not exist "node_modules\discord.js" (
    call npm ci
    if errorlevel 1 (
        echo Dependency installation failed. Check the npm error above.
        pause
        exit /b 1
    )
)

:START
echo Starting Puro. Commands, events, and components reload automatically.
node --max-old-space-size=%PURO_MAX_HEAP_MB% app.js
if "%PURO_AUTO_RESTART%"=="0" exit /b %errorlevel%
echo Puro stopped. Restarting in %PURO_RESTART_DELAY_SECONDS% seconds. Press Ctrl+C to stop.
timeout /t %PURO_RESTART_DELAY_SECONDS% /nobreak >nul
goto START
