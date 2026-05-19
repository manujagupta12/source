@echo off
title AlgoTrade NSE Platform + Live Algo
color 0A

echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║   ALGOTRADE — FULL PLATFORM + ALGO ENGINE            ║
echo  ║   Data: NSE API + MultiTrade XLS (live)              ║
echo  ╚══════════════════════════════════════════════════════╝
echo.
echo  IMPORTANT: Make sure MultiTrade is open and writing to:
echo    C:\AlgoTrading\data\multitrade_feed.xls
echo.
echo  Choose algo:
echo  [1] Calendar Spread only  (Calendaralgofinal.py)
echo  [2] All 7 Strategies      (multistrategy.py)
echo  [3] Dashboard only        (no algo terminal)
echo.
set /p CHOICE=Enter 1, 2, or 3: 

REM ── Deps ────────────────────────────────────────────────────
echo  Installing dependencies...
pip install -q fastapi "uvicorn[standard]" pandas xlrd==2.0.1 bcrypt "python-jose[cryptography]" python-dotenv requests numpy 2>nul
cd /d "%~dp0app\frontend"
if not exist "node_modules" npm install --silent
cd /d "%~dp0"

REM ── Create dirs ──────────────────────────────────────────────
if not exist "C:\AlgoTrading\data" mkdir "C:\AlgoTrading\data"
if not exist "C:\AlgoTrading\logs" mkdir "C:\AlgoTrading\logs"

REM ── Backend ──────────────────────────────────────────────────
start "AlgoTrade API (port 8000)" cmd /k "title AlgoTrade API && cd /d "%~dp0app\backend" && python main.py"
timeout /t 4 /nobreak >nul

REM ── Frontend ─────────────────────────────────────────────────
start "AlgoTrade Dashboard (port 5173)" cmd /k "title AlgoTrade Dashboard && cd /d "%~dp0app\frontend" && npm run dev"
timeout /t 4 /nobreak >nul

REM ── Algo Engine ──────────────────────────────────────────────
if "%CHOICE%"=="1" (
    echo  Starting Calendar Spread algo...
    start "Calendar Algo — NSE+MultiTrade" cmd /k "title Calendar Spread Algo && cd /d "%~dp0algo" && python Calendaralgofinal.py"
)
if "%CHOICE%"=="2" (
    echo  Starting All-7-Strategies algo...
    start "Multi-Strategy Algo — NSE+MultiTrade" cmd /k "title Multi-Strategy Algo && cd /d "%~dp0algo" && python multistrategy.py"
)

REM ── Open browser ─────────────────────────────────────────────
timeout /t 3 /nobreak >nul
start "" "http://localhost:5173"

echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║  ✅  All components launched                         ║
echo  ║                                                      ║
echo  ║  Dashboard  :  http://localhost:5173                 ║
echo  ║  API docs   :  http://localhost:8000/docs            ║
echo  ║  Login      :  demo@algotrade.in / demo123           ║
echo  ║                                                      ║
echo  ║  The algo window will ask for your margin (₹)        ║
echo  ║  Enter e.g. 50L or 5000000                           ║
echo  ╚══════════════════════════════════════════════════════╝
echo.
pause