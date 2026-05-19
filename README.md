# AlgoTrade — NSE F&O Signal Platform

NIFTY / BANKNIFTY / FINNIFTY options trading system.

**Data sources: NSE API + MultiTrade XLS only.**
No Delta Exchange. No crypto.

---

## Single Click Start

### Dashboard + API only
```
Double-click: START.bat
```

### Dashboard + API + Live Algo Engine
```
Double-click: START_WITH_ALGO.bat
```

Opens at **http://localhost:5173**
Login: `demo@algotrade.in` / `demo123`

---

## What Runs

| Window | Port | Purpose |
|--------|------|---------|
| AlgoTrade API | 8000 | FastAPI backend, WebSocket signals |
| AlgoTrade Dashboard | 5173 | React frontend |
| Calendar Algo | terminal | Live signals from MultiTrade XLS |
| Multi-Strategy Algo | terminal | All 7 strategies |

---

## Data Sources

### 1. MultiTrade XLS (primary — live greeks + spread data)
- Place at `C:\AlgoTrading\data\multitrade_feed.xls`
- Keep MultiTrade software open and writing
- `algo/multitrade_loader.py` reads it correctly (header row 9, all columns mapped)

### 2. NSE Direct API (live index prices, VIX, option chain)
- `algo/nse_connector.py` — no API key needed
- Optionally start the NSE server for faster data:
  ```
  npx stock-nse-india@latest
  ```

---

## Strategies

| ID | Name | When |
|----|------|------|
| S1 | Calendar Spread | Sideways, VIX < 16 |
| S2 | Iron Condor | Range-bound |
| S3 | Short Straddle | High IV, sideways |
| S4 | Momentum Breakout | Trending |
| S5 | Delta Hedge Strangle | VIX spikes |
| S6 | Expiry 0DTE | DTE ≤ 3 |
| S7 | Ratio Spread | Mild directional |
| E1–E4 | NSE Equity | Intraday |

## Market Regimes

| Regime | VIX | Size |
|--------|-----|------|
| R1 Dead Market | flat | 10% |
| R2 Sideways Low | < 13 | 100% |
| R3 Sideways High IV | 13–16 | 80% |
| R4 Trending Bull | rising | 70% |
| R5 Trending Bear | falling | 70% |
| R6 High Vol | 19–22 | 45% |
| R7 Expiry | DTE ≤ 3 | 55% |
| R8 Extreme Panic | > 22 | STOP |

---

## Manual Setup

```bash
pip install -r requirements.txt
cd app/frontend && npm install
```

Run separately:
```bash
# Terminal 1 — API
cd app/backend && python main.py

# Terminal 2 — Dashboard
cd app/frontend && npm run dev

# Terminal 3 — Algo (optional)
cd algo && python Calendaralgofinal.py
# or
cd algo && python multistrategy.py
```

---

## File Structure

```
source/
├── START.bat                  ← Double-click to launch
├── START_WITH_ALGO.bat        ← Double-click to launch + algo
├── algo/
│   ├── multitrade_loader.py   ← XLS parser (shared by all scripts)
│   ├── Calendaralgofinal.py   ← Calendar spread live algo
│   ├── multistrategy.py       ← All 7 strategies
│   ├── nse_connector.py       ← NSE live data
│   ├── position_sizer.py      ← Dynamic lot sizing
│   └── Equity_India.py        ← NSE equity signals
├── app/
│   ├── backend/main.py        ← FastAPI server
│   └── frontend/src/App.jsx   ← React dashboard
├── backtest/
│   └── backtest_engine.py     ← 5-year NSE backtest
└── requirements.txt
```

---

© 2025 manujagupta12 — Private