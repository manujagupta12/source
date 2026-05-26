<div align="center">

# 📈 AlgoTrade — NSE F&O Signal Platform

**Version 1.0.0** — Production-ready, fully containerised

[![CI/CD](https://github.com/manujagupta12/source/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/manujagupta12/source/actions/workflows/ci-cd.yml)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)](https://github.com/manujagupta12/source/pkgs/container/algotrade-backend)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> A real-time NSE F&O signal dashboard covering every major India options trading strategy.
> Built with FastAPI + React/Vite. Ships as a single `docker compose up` command.

</div>

---

## ✨ What’s Inside — Version 1 Feature Set

### 📊 F&O Strategies
| ID | Strategy | Type | Instruments |
|----|----------|------|-------------|
| S1 | **Calendar Spread** | Neutral time-decay | NIFTY, BANKNIFTY, FINNIFTY |
| S2 | **Iron Condor** | Neutral range-bound | NIFTY, BANKNIFTY, FINNIFTY |
| S3 | **Short Straddle** | High-IV crush | NIFTY, BANKNIFTY, FINNIFTY |
| S4 | **0DTE Scalp** | Expiry momentum | NIFTY, BANKNIFTY, FINNIFTY |
| S5 | **PCR Contrarian** 🆕 | OI-based reversal | NIFTY, BANKNIFTY, FINNIFTY |

### 📈 Equity Strategies
| ID | Strategy | Signal type |
|----|----------|-------------|
| E1 | EMA Crossover | Momentum |
| E2 | VWAP Reversion | Mean-reversion |
| E3 | ORB Breakout | Opening Range |
| E4 | Gap Fill | Overnight gap |

### 🛠️ Platform Features
- ⚡ Real-time WebSocket signal push (5s cycle)
- 📊 PCR OI chart — 3-line (Call OI / Put OI / Index Spot) per instrument
- 📋 Strategy segregation dashboard with live counts
- 📄 Paper trading with ₹50L virtual capital + P&L tracking
- 💳 Subscription tiers (Free / Starter ₹2,999 / Pro ₹7,999 / Elite ₹19,999)
- 📱 Fully responsive — desktop sidebar + mobile bottom nav
- 🔄 Zero-duplicate signal engine (fingerprint dedup)
- 📞 Live NSE index ticker (NIFTY, BANKNIFTY, FINNIFTY, VIX, MIDCAP)
- 📉 Analytics tab with P&L by strategy bar chart
- 🔐 JWT auth with bcrypt passwords
- ✅ MultiTrade XLS feed integration

---

## 🚀 Quick Start — Docker (Recommended)

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/Mac) or Docker Engine 24+ (Linux)
- Port `80` and `8000` available

```bash
# 1. Clone
git clone https://github.com/manujagupta12/source.git algotrade
cd algotrade

# 2. Configure (optional — defaults work for local dev)
cp .env.example .env

# 3. Launch everything
docker compose up --build

# 4. Open browser
open http://localhost
# Login: demo@algotrade.in / demo123
```

That’s it. No Python, no Node, no manual installs.

---

## 📦 Pull Pre-built Images (GitHub Container Registry)

Once CI/CD has run at least once, images are published to GHCR:

```bash
# Pull
docker pull ghcr.io/manujagupta12/algotrade-backend:latest
docker pull ghcr.io/manujagupta12/algotrade-frontend:latest

# Run directly without building
docker compose pull
docker compose up -d
```

---

## 💻 Local Development (without Docker)

### Backend
```bash
cd app/backend
pip install -r requirements.txt
python main.py
# API:  http://localhost:8000
# Docs: http://localhost:8000/docs
```

### Frontend
```bash
cd app/frontend
npm install
npm run dev
# UI: http://localhost:5173
```

---

## 🌐 Production Deployment

### VPS / Cloud VM (single machine)

```bash
# 1. SSH into server
ssh user@your-server-ip

# 2. Clone repo
git clone https://github.com/manujagupta12/source.git algotrade && cd algotrade

# 3. Set production secret
echo "SECRET_KEY=$(openssl rand -hex 32)" > .env

# 4. Run with production overrides
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 5. Check health
docker compose ps
curl http://localhost:8000/health
```

### Update to new version
```bash
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

---

## 🔄 CI/CD Pipeline

The GitHub Actions pipeline at `.github/workflows/ci-cd.yml` runs automatically on every push to `main`:

```
Push to main
    │
    ├─► [1] Lint & Test
    │       ├─► flake8 backend
    │       ├─► Python import validation
    │       └─► Vite build check
    │
    ├─► [2] Build & Push Docker Images
    │       ├─► algotrade-backend  → ghcr.io (linux/amd64 + arm64)
    │       └─► algotrade-frontend → ghcr.io (linux/amd64 + arm64)
    │
    └─► [3] Release (on semver tag v*.*.* only)
            └─► GitHub Release + .tar.gz deployment bundle
```

### Create a release
```bash
git tag v1.0.0
git push origin v1.0.0
# → Triggers full pipeline + publishes GitHub Release
```

---

## 📁 Project Structure

```
algotrade/
├── Dockerfile.backend       # Python 3.11 slim — FastAPI
├── Dockerfile.frontend      # Node 20 build → nginx:alpine serve
├── docker-compose.yml       # Dev compose (one command launch)
├── docker-compose.prod.yml  # Production resource limits + logging
├── nginx.conf               # SPA fallback + API/WS proxy
├── .env.example             # Environment variable template
├── .github/
│   └── workflows/
│       └── ci-cd.yml           # Full CI/CD pipeline
├── algo/                    # Strategy engines (Python)
│   ├── pcr_strategy.py        # S5 PCR Contrarian (OI-based)
│   ├── Calendaralgofinal.py   # S1 Calendar Spread
│   ├── multistrategy.py       # S2–S4 engines
│   ├── nse_connector.py       # NSE API client
│   └── Multitrade_loader.py   # XLS feed parser
├── app/
│   ├── backend/
│   │   ├── main.py              # FastAPI app (v3.1.0)
│   │   └── requirements.txt     # Pinned Python deps
│   └── frontend/
│       ├── src/
│       │   ├── App.jsx            # Full dashboard (dedup + PCR chart)
│       │   └── main.jsx           # React entry point
│       ├── index.html           # PWA-ready viewport
│       └── vite.config.js
└── data/                    # Mount MultiTrade .xls feed here
```

---

## 🔧 Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | `algotrade-dev-secret-CHANGE-IN-PROD` | JWT signing key — **change in production** |
| `VITE_API_URL` | `http://localhost:8000` | Backend REST URL (build-time) |
| `VITE_WS_URL` | `ws://localhost:8000` | Backend WebSocket URL (build-time) |

For production behind a domain, set:
```bash
VITE_API_URL=https://api.yourdomain.com
VITE_WS_URL=wss://api.yourdomain.com
```

---

## 🛑 Disclaimer

> This software is for **educational and research purposes only**.
> It is not SEBI-registered investment advice.
> Always consult a qualified financial advisor before trading.
> Past signal performance does not guarantee future results.

---

## 📅 Roadmap — Version 2

- [ ] Broker API integration (Zerodha / Upstox / Angel One)
- [ ] Auto-execution with position sizing
- [ ] PostgreSQL persistence (signals + trade history)
- [ ] Redis WebSocket broker (multi-instance)
- [ ] Telegram / WhatsApp alert integration
- [ ] Backtesting engine with historical NSE data
- [ ] Options chain live visualisation
- [ ] Multi-user SaaS with Razorpay billing

---

<div align="center">

Built with ❤️ for India’s F&O traders

**v1.0.0** — May 2026

</div>
