"""
ALGOTRADE BACKEND  —  app/backend/main.py
==========================================
FastAPI production server with:
  - JWT authentication
  - WebSocket live signal streaming
  - Trade logging API
  - P&L analytics
  - Subscription tier enforcement
  - Background algo engine runner
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from contextlib import asynccontextmanager
import asyncio, json, hashlib, os
from datetime import datetime, timedelta, date
from typing import Optional, List
import uvicorn

# ── Optional heavy imports (graceful if missing) ─────────────────
try:
    from jose import JWTError, jwt
    _JWT_OK = True
except ImportError:
    _JWT_OK = False

# Use bcrypt directly — passlib is broken on Python 3.14 + newer bcrypt
try:
    import bcrypt as _bcrypt_lib
    _BCRYPT_OK = True
except ImportError:
    _BCRYPT_OK = False

try:
    from pydantic import BaseModel
except ImportError:
    from pydantic import BaseModel  # type: ignore

# ════════════════════════════════════════════════════════════════
#  CONFIG
# ════════════════════════════════════════════════════════════════
SECRET_KEY     = os.environ.get("SECRET_KEY", "algotrade-secret-key-change-in-prod")
ALGORITHM      = "HS256"
TOKEN_EXPIRE   = 60 * 24   # minutes

# In production replace with PostgreSQL via SQLAlchemy
# For now uses in-memory store — swap the _db dict for real DB calls
_db = {
    "users":       {},   # email -> user_dict
    "trades":      {},   # user_email -> [trade_dict]
    "signals":     [],   # latest signals (rolling 100)
    "regime":      {},   # current regime
}

# Subscription tiers
TIERS = {
    "free":    {"strategies": 2,  "instruments": 1, "live": False},
    "starter": {"strategies": 7,  "instruments": 3, "live": True},
    "pro":     {"strategies": 7,  "instruments": 5, "live": True},
    "elite":   {"strategies": 7,  "instruments": 6, "live": True},
}

# ════════════════════════════════════════════════════════════════
#  AUTH HELPERS
#  Uses bcrypt directly — passlib is incompatible with Python 3.14
# ════════════════════════════════════════════════════════════════
def hash_password(pw: str) -> str:
    """Hash a password using bcrypt (or SHA-256 fallback)."""
    if _BCRYPT_OK:
        # bcrypt requires bytes; encode to UTF-8, truncate to 72 bytes max
        pw_bytes = pw.encode("utf-8")[:72]
        return _bcrypt_lib.hashpw(pw_bytes, _bcrypt_lib.gensalt()).decode("utf-8")
    # SHA-256 fallback (acceptable for dev/demo — use bcrypt in production)
    return hashlib.sha256(pw.encode("utf-8")).hexdigest()

def verify_password(pw: str, hashed: str) -> bool:
    """Verify a password against its hash."""
    if _BCRYPT_OK:
        try:
            pw_bytes     = pw.encode("utf-8")[:72]
            hashed_bytes = hashed.encode("utf-8")
            return _bcrypt_lib.checkpw(pw_bytes, hashed_bytes)
        except Exception:
            return False
    return hashlib.sha256(pw.encode("utf-8")).hexdigest() == hashed

def create_token(data: dict, expires_minutes: int = TOKEN_EXPIRE) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(minutes=expires_minutes)
    if _JWT_OK:
        return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    # Base64 fallback for dev (not secure — install python-jose for production)
    import base64
    return base64.b64encode(json.dumps(payload).encode()).decode()

def decode_token(token: str) -> Optional[dict]:
    try:
        if _JWT_OK:
            return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        import base64
        return json.loads(base64.b64decode(token.encode()).decode())
    except Exception:
        return None

security = HTTPBearer(auto_error=False)

def get_current_user(creds: HTTPAuthorizationCredentials = Depends(security)):
    if not creds:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(creds.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    email = payload.get("sub")
    user  = _db["users"].get(email)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

def get_optional_user(creds: HTTPAuthorizationCredentials = Depends(security)):
    if not creds:
        return None
    payload = decode_token(creds.credentials)
    if not payload:
        return None
    return _db["users"].get(payload.get("sub"))

# ════════════════════════════════════════════════════════════════
#  PYDANTIC MODELS
# ════════════════════════════════════════════════════════════════
class RegisterRequest(BaseModel):
    name:     str
    email:    str
    password: str

class LoginRequest(BaseModel):
    email:    str
    password: str

class TradeLogRequest(BaseModel):
    strategy:     str
    instrument:   str
    option_type:  str
    direction:    str
    near_strike:  int
    far_strike:   int
    lots:         int
    entry_spread: float
    notes:        Optional[str] = ""

class TradeCloseRequest(BaseModel):
    trade_id:    str
    exit_spread: float
    notes:       Optional[str] = ""

# ════════════════════════════════════════════════════════════════
#  WEBSOCKET CONNECTION MANAGER
# ════════════════════════════════════════════════════════════════
class SignalBroadcaster:
    def __init__(self):
        self.connections: List[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.connections.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.connections:
            self.connections.remove(ws)

    async def broadcast(self, message: dict):
        payload = json.dumps(message)
        dead    = []
        for ws in self.connections:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

broadcaster = SignalBroadcaster()

# ════════════════════════════════════════════════════════════════
#  MOCK SIGNAL GENERATOR
#  Replace this with the real algo engine output in production.
#  The real algo writes signals to a Redis queue;
#  this background task reads and broadcasts them.
# ════════════════════════════════════════════════════════════════
import random

MOCK_STRATEGIES = [
    "S1 CALENDAR", "S2 IRON CONDOR", "S3 SHORT STRADDLE",
    "S4 MOMENTUM", "S7 RATIO SPREAD"
]
MOCK_REGIMES = [
    "R2 SIDEWAYS LOW", "R3 SIDEWAYS HIGH IV",
    "R4 TRENDING BULL", "R6 HIGH VOLATILITY"
]

def generate_mock_signal():
    spot   = 23800 + random.randint(-200, 200)
    atm    = int(round(spot / 50) * 50)
    strat  = random.choice(MOCK_STRATEGIES)
    score  = random.randint(45, 95)
    dirn   = random.choice(["LONG", "SHORT"])
    spread = round(random.uniform(-8, 8), 2)
    fair   = round(spread + random.uniform(-3, 3), 2)
    vix    = round(random.uniform(12, 22), 2)

    return {
        "timestamp":    datetime.now().isoformat(),
        "strategy":     strat,
        "score":        score,
        "direction":    dirn,
        "instrument":   "NIFTY",
        "near_strike":  atm,
        "far_strike":   atm,
        "spread":       spread,
        "fair_value":   fair,
        "deviation":    round(spread - fair, 2),
        "vix":          vix,
        "regime":       random.choice(MOCK_REGIMES),
        "risk":         ("LOW" if vix < 13 else "MEDIUM" if vix < 19 else "HIGH"),
        "near_bid":     round(150 + random.uniform(-20, 20), 2),
        "near_ask":     round(152 + random.uniform(-20, 20), 2),
        "far_bid":      round(155 + random.uniform(-20, 20), 2),
        "far_ask":      round(157 + random.uniform(-20, 20), 2),
        "buy_far_at":   round(155.5 + random.uniform(-5, 5), 2),
        "sell_near_at": round(149.5 + random.uniform(-5, 5), 2),
        "target_pts":   4,
        "sl_pts":       3,
        "lots_suggested": random.randint(1, 8),
    }

async def signal_broadcast_loop():
    """Background task: generates and broadcasts signals every 5 seconds."""
    while True:
        await asyncio.sleep(5)
        signal = generate_mock_signal()
        _db["signals"].append(signal)
        _db["signals"] = _db["signals"][-100:]   # keep last 100
        await broadcaster.broadcast({"type": "signal", "data": signal})

        # Also broadcast regime update every 30 signals
        if len(_db["signals"]) % 30 == 0:
            regime_update = {
                "type":     "regime",
                "regime":   signal["regime"],
                "vix":      signal["vix"],
                "risk":     signal["risk"],
                "timestamp":signal["timestamp"],
            }
            await broadcaster.broadcast(regime_update)

# ════════════════════════════════════════════════════════════════
#  APP LIFECYCLE
# ════════════════════════════════════════════════════════════════
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Seed a demo user
    if "demo@algotrade.in" not in _db["users"]:
        _db["users"]["demo@algotrade.in"] = {
            "name":         "Demo User",
            "email":        "demo@algotrade.in",
            "password":     hash_password("demo123"),
            "plan":         "pro",
            "joined":       str(date.today()),
            "daily_target": 50000,
        }

    # Start signal broadcast loop
    task = asyncio.create_task(signal_broadcast_loop())
    yield
    task.cancel()

app = FastAPI(
    title       = "AlgoTrade API",
    description = "NIFTY/BANKNIFTY Multi-Strategy Signal Platform",
    version     = "1.0.0",
    lifespan    = lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins     = ["*"],   # lock down to your domain in production
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

# ════════════════════════════════════════════════════════════════
#  AUTH ROUTES
# ════════════════════════════════════════════════════════════════
@app.post("/auth/register")
def register(req: RegisterRequest):
    if req.email in _db["users"]:
        raise HTTPException(status_code=400, detail="Email already registered")
    _db["users"][req.email] = {
        "name":         req.name,
        "email":        req.email,
        "password":     hash_password(req.password),
        "plan":         "free",
        "joined":       str(date.today()),
        "daily_target": 50000,
    }
    token = create_token({"sub": req.email})
    return {"token": token, "user": {k: v for k, v in
            _db["users"][req.email].items() if k != "password"}}

@app.post("/auth/login")
def login(req: LoginRequest):
    user = _db["users"].get(req.email)
    if not user or not verify_password(req.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token({"sub": req.email})
    return {"token": token, "user": {k: v for k, v in user.items() if k != "password"}}

@app.get("/auth/me")
def me(user = Depends(get_current_user)):
    return {k: v for k, v in user.items() if k != "password"}

# ════════════════════════════════════════════════════════════════
#  SIGNAL ROUTES
# ════════════════════════════════════════════════════════════════
@app.get("/signals/latest")
def get_latest_signals(limit: int = 20, user = Depends(get_optional_user)):
    signals = _db["signals"][-limit:][::-1]
    tier    = TIERS.get(user["plan"] if user else "free", TIERS["free"])
    if not tier["live"]:
        # Free tier gets 15-minute delayed data (just return fewer)
        signals = signals[:5]
    return {"signals": signals, "count": len(signals)}

@app.get("/signals/regime")
def get_regime():
    if _db["signals"]:
        last = _db["signals"][-1]
        return {
            "regime":    last.get("regime", "DETECTING"),
            "vix":       last.get("vix", 0),
            "risk":      last.get("risk", "MEDIUM"),
            "timestamp": last.get("timestamp"),
        }
    return {"regime": "DETECTING", "vix": 0, "risk": "UNKNOWN"}

@app.get("/signals/history")
def signal_history(days: int = 7, user = Depends(get_current_user)):
    return {"signals": _db["signals"], "days": days}

# ════════════════════════════════════════════════════════════════
#  TRADE ROUTES
# ════════════════════════════════════════════════════════════════
@app.post("/trades/enter")
def enter_trade(req: TradeLogRequest, user = Depends(get_current_user)):
    import uuid
    email    = user["email"]
    trade_id = str(uuid.uuid4())[:8].upper()
    trade    = {
        "id":           trade_id,
        "date":         str(date.today()),
        "entry_time":   datetime.now().isoformat(),
        "exit_time":    None,
        "strategy":     req.strategy,
        "instrument":   req.instrument,
        "type":         req.option_type,
        "direction":    req.direction,
        "near_strike":  req.near_strike,
        "far_strike":   req.far_strike,
        "lots":         req.lots,
        "entry_spread": req.entry_spread,
        "exit_spread":  None,
        "pnl_pts":      None,
        "pnl_inr":      None,
        "status":       "OPEN",
        "notes":        req.notes,
    }
    if email not in _db["trades"]:
        _db["trades"][email] = []
    _db["trades"][email].append(trade)
    return {"trade_id": trade_id, "trade": trade}

@app.post("/trades/close")
def close_trade(req: TradeCloseRequest, user = Depends(get_current_user)):
    email  = user["email"]
    trades = _db["trades"].get(email, [])
    trade  = next((t for t in trades if t["id"] == req.trade_id), None)
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    if trade["status"] == "CLOSED":
        raise HTTPException(status_code=400, detail="Already closed")

    lot_sizes = {"NIFTY": 25, "BANKNIFTY": 15, "FINNIFTY": 40}
    ls  = lot_sizes.get(trade["instrument"], 25)
    entry = float(trade["entry_spread"])
    exit_ = float(req.exit_spread)
    dirn  = trade["direction"]

    pnl_pts = (exit_ - entry) if dirn in ("LONG","BUY BOTH","BULL") else (entry - exit_)
    pnl_inr = round(pnl_pts * ls * trade["lots"], 0)

    trade.update({
        "exit_time":   datetime.now().isoformat(),
        "exit_spread": req.exit_spread,
        "pnl_pts":     round(pnl_pts, 2),
        "pnl_inr":     int(pnl_inr),
        "status":      "CLOSED",
        "notes":       (trade.get("notes","") + " | " + req.notes).strip(" | "),
    })
    return {"trade": trade, "pnl_inr": int(pnl_inr)}

@app.get("/trades/today")
def today_trades(user = Depends(get_current_user)):
    email  = user["email"]
    trades = _db["trades"].get(email, [])
    today  = str(date.today())
    todays = [t for t in trades if t.get("date") == today]
    realised = sum(t["pnl_inr"] for t in todays if t.get("pnl_inr") and t["status"]=="CLOSED")
    open_c   = sum(1 for t in todays if t["status"] == "OPEN")
    return {
        "trades":       todays,
        "realised_pnl": realised,
        "open_count":   open_c,
        "daily_target": user.get("daily_target", 50000),
        "remaining":    max(0, user.get("daily_target", 50000) - realised),
    }

@app.get("/trades/history")
def trade_history(days: int = 30, user = Depends(get_current_user)):
    email  = user["email"]
    trades = _db["trades"].get(email, [])
    return {"trades": trades[-100:], "total": len(trades)}

# ════════════════════════════════════════════════════════════════
#  ANALYTICS ROUTES
# ════════════════════════════════════════════════════════════════
@app.get("/analytics/summary")
def analytics_summary(user = Depends(get_current_user)):
    email  = user["email"]
    trades = [t for t in _db["trades"].get(email, []) if t["status"] == "CLOSED"]
    if not trades:
        return {"message": "No closed trades yet"}

    pnls     = [t["pnl_inr"] for t in trades if t.get("pnl_inr")]
    wins     = [p for p in pnls if p > 0]
    losses   = [p for p in pnls if p <= 0]
    by_strat = {}
    for t in trades:
        s = t["strategy"]
        if s not in by_strat:
            by_strat[s] = {"trades":0, "wins":0, "total_pnl":0}
        by_strat[s]["trades"]    += 1
        by_strat[s]["wins"]      += 1 if (t.get("pnl_inr") or 0) > 0 else 0
        by_strat[s]["total_pnl"] += (t.get("pnl_inr") or 0)

    return {
        "total_trades":   len(trades),
        "win_rate":       round(len(wins)/len(pnls)*100, 1) if pnls else 0,
        "total_pnl":      sum(pnls),
        "avg_pnl":        round(sum(pnls)/len(pnls), 0) if pnls else 0,
        "best_trade":     max(pnls) if pnls else 0,
        "worst_trade":    min(pnls) if pnls else 0,
        "by_strategy":    by_strat,
    }

@app.get("/analytics/daily")
def daily_pnl(days: int = 30, user = Depends(get_current_user)):
    email   = user["email"]
    trades  = [t for t in _db["trades"].get(email,[]) if t["status"]=="CLOSED"]
    by_date = {}
    for t in trades:
        d = t.get("date","")
        if d not in by_date:
            by_date[d] = {"date":d,"pnl":0,"trades":0,"wins":0}
        by_date[d]["pnl"]    += (t.get("pnl_inr") or 0)
        by_date[d]["trades"] += 1
        by_date[d]["wins"]   += 1 if (t.get("pnl_inr") or 0) > 0 else 0
    return {"daily": sorted(by_date.values(), key=lambda x: x["date"])}

# ════════════════════════════════════════════════════════════════
#  PAPER TRADING ROUTES
# ════════════════════════════════════════════════════════════════
_paper_accounts = {}   # email -> {balance, trades}

@app.get("/paper/account")
def paper_account(user = Depends(get_current_user)):
    email = user["email"]
    if email not in _paper_accounts:
        _paper_accounts[email] = {
            "balance":    5_000_000,   # ₹50 lakh virtual
            "initial":    5_000_000,
            "trades":     [],
            "created":    str(date.today()),
        }
    acc = _paper_accounts[email]
    pnl = acc["balance"] - acc["initial"]
    return {**acc, "total_pnl": pnl, "pnl_pct": round(pnl/acc["initial"]*100, 2)}

@app.post("/paper/trade")
def paper_trade(req: TradeLogRequest, user = Depends(get_current_user)):
    import uuid
    email = user["email"]
    if email not in _paper_accounts:
        _paper_accounts[email] = {"balance": 5_000_000, "initial": 5_000_000, "trades": []}

    margin = {"NIFTY": 80000, "BANKNIFTY": 90000, "FINNIFTY": 50000}
    cost   = margin.get(req.instrument, 80000) * req.lots

    if _paper_accounts[email]["balance"] < cost:
        raise HTTPException(status_code=400, detail="Insufficient paper capital")

    _paper_accounts[email]["balance"] -= cost
    trade = {
        "id":           str(uuid.uuid4())[:8].upper(),
        "date":         str(date.today()),
        "entry_time":   datetime.now().isoformat(),
        "strategy":     req.strategy,
        "instrument":   req.instrument,
        "lots":         req.lots,
        "entry_spread": req.entry_spread,
        "status":       "OPEN",
        "margin_used":  cost,
    }
    _paper_accounts[email]["trades"].append(trade)
    return {"paper_trade": trade, "remaining_balance": _paper_accounts[email]["balance"]}

@app.get("/paper/leaderboard")
def paper_leaderboard():
    board = []
    for email, acc in _paper_accounts.items():
        pnl = acc["balance"] - acc["initial"]
        user = _db["users"].get(email, {})
        board.append({
            "name":    user.get("name", "Anonymous"),
            "pnl":     pnl,
            "pnl_pct": round(pnl/acc["initial"]*100, 2),
            "trades":  len(acc["trades"]),
        })
    return {"leaderboard": sorted(board, key=lambda x: x["pnl"], reverse=True)[:20]}

# ════════════════════════════════════════════════════════════════
#  SUBSCRIPTION ROUTES
# ════════════════════════════════════════════════════════════════
@app.get("/subscription/plans")
def get_plans():
    return {"plans": [
        {"id":"free",    "name":"Free",        "price":0,      "price_str":"₹0/mo",
         "features":["Paper trading","Delayed signals","2 strategies","Community support"]},
        {"id":"starter", "name":"Starter",     "price":2999,   "price_str":"₹2,999/mo",
         "features":["Live signals","All 7 strategies","3 instruments","Email support"]},
        {"id":"pro",     "name":"Pro",         "price":7999,   "price_str":"₹7,999/mo",
         "features":["Everything in Starter","All 5 instruments","Backtest access",
                     "Regime alerts","Priority support"]},
        {"id":"elite",   "name":"Elite",       "price":19999,  "price_str":"₹19,999/mo",
         "features":["Everything in Pro","API access","Custom alerts",
                     "1-on-1 strategy call","Dedicated account manager"]},
    ]}

@app.post("/subscription/upgrade")
def upgrade_plan(plan: str, user = Depends(get_current_user)):
    if plan not in TIERS:
        raise HTTPException(status_code=400, detail="Invalid plan")
    # In production: verify Razorpay payment here first
    _db["users"][user["email"]]["plan"] = plan
    return {"message": f"Upgraded to {plan}", "plan": plan}

# ════════════════════════════════════════════════════════════════
#  WEBSOCKET ENDPOINT
# ════════════════════════════════════════════════════════════════
@app.websocket("/ws/signals")
async def websocket_signals(ws: WebSocket):
    await broadcaster.connect(ws)
    try:
        # Send last 5 signals on connect
        recent = _db["signals"][-5:] if _db["signals"] else []
        for sig in recent:
            await ws.send_text(json.dumps({"type": "signal", "data": sig}))
        # Keep alive
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        broadcaster.disconnect(ws)

# ════════════════════════════════════════════════════════════════
#  HEALTH CHECK
# ════════════════════════════════════════════════════════════════
@app.get("/health")
def health():
    return {
        "status":    "ok",
        "version":   "1.0.0",
        "users":     len(_db["users"]),
        "signals":   len(_db["signals"]),
        "timestamp": datetime.now().isoformat(),
    }

@app.get("/")
def root():
    return {"message": "AlgoTrade API", "docs": "/docs"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)