@echo off
chcp 65001 >nul
title MoneyPrinter Auto-Pilot
cd /d "C:\Users\sunny\MoneyPrinterTurbo"

echo ============================================
echo   YouTube Auto-Pilot - 1 video generation
echo   Topic: auto-picked from niche bank
echo ============================================
echo.

call venv\Scripts\python.exe autopilot.py

pause
