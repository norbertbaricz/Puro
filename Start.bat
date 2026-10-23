@echo off
chcp 65001 >nul
title Discord Bot
color 0A

:START
cls
echo =========================================
echo [ %time% ] Starting Discord bot...
echo =========================================
echo.

:: Main process execution limited to 512MB RAM
node --max-old-space-size=512 app.js

echo.
echo =========================================
echo [!] The bot has stopped or crashed.
echo [!] Restarting in 5 seconds...
echo [!] Press CTRL+C to cancel the restart.
echo =========================================
timeout /t 5 /nobreak >nul

goto START