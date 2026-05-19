@echo off
title AlgoTrade NSE Platform
color 0A

echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║   ALGOTRADE NSE F^&O PLATFORM  —  Single Click Start  ║
echo  ║   Data: NSE API + MultiTrade XLS                     ║
echo  ╚══════════════════════════════════════════════════════╝
echo.

REM ── Check Python ────────────────────────────────────────────
where python >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Python not found. Install from python.org
    pause & exit /b 1
)

REM ── Check Node ──────────────────────────────────────────────
where node >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Node.js not found. Install from nodejs.org
    pause & exit /b 1
)

REM ── Python deps ─────────────────────────────────────────────
echo  [1/3] Installing Python dependencies...
pip install -q fastapi "uvicorn[standard]" pandas xlrd==2.0.1 bcrypt "python-jose[cryptography]" python-dotenv requests numpy 2>nul
echo  [1/3] Done

REM ── Node deps ───────────────────────────────────────────────
echo  [2/3] Checking frontend dependencies...
cd /d "%~dp0app\frontend"
if not exist "node_modules" (
    echo  [2/3] Installing npm packages (first run only)...
    npm install --silent
)
echo  [2/3] Done
cd /d "%~dp0"

REM ── Create data dirs ─────────────────────────────────────────
if not exist "C:\AlgoTrading\data" mkdir "C:\AlgoTrading\data"
if not exist "C:\AlgoTrading\logs" mkdir "C:\AlgoTrading\logs"

REM ── Start Backend ────────────────────────────────────────────
echo  [3/3] Starting API backend on port 8000...
start "AlgoTrade API" cmd /k "title AlgoTrade API && cd /d "%~dp0app\backend" && python main.py"
timeout /t 4 /nobreak >nul

REM ── Start Frontend ───────────────────────────────────────────
echo  [3/3] Starting React dashboard on port 5173...
start "AlgoTrade Dashboard" cmd /k "title AlgoTrade Dashboard && cd /d "%~dp0app\frontend" && npm run dev"
timeout /t 5 /nobreak >nul

REM ── Open browser ─────────────────────────────────────────────
start "" "http://localhost:5173"

echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║  ✅  Platform is running                             ║
echo  ║                                                      ║
echo  ║  Dashboard  :  http://localhost:5173                 ║
echo  ║  API docs   :  http://localhost:8000/docs            ║
echo  ║  Login      :  demo@algotrade.in / demo123           ║
echo  ║                                                      ║
echo  ║  For live signals from MultiTrade XLS:               ║
echo  ║    Double-click  START_WITH_ALGO.bat                 ║
echo  ╚══════════════════════════════════════════════════════╝
echo.
pause