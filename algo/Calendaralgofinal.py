"""
CALENDAR SPREAD ALGO — Calendaralgofinal.py
============================================
Live BANKNIFTY/NIFTY calendar spread signals from MultiTrade XLS.

  python Calendaralgofinal.py

FIX: Added _push() helper — every CE/PE tick, entry, exit now POSTs to
     http://localhost:8000/signals/fo_ingest so the dashboard shows live
     F&O calendar signals in real time.
"""

import sys
import os
import time
import requests
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    import multitrade_loader as loader
    print("  [OK] multitrade_loader imported")
except ImportError as e:
    print(f"  [ERROR] {e}")
    sys.exit(1)

# ── Settings ──────────────────────────────────────────────────
XLS_PATH    = r"C:\AlgoTrading\data\multitrade_feed.xls"
TEMP_PATH   = r"C:\AlgoTrading\data\_temp_read.xls"
TARGET      = 8
STOPLOSS    = 6
THRESHOLD   = 5
REFRESH     = 3
VIX_PAUSE   = 22
VIX_CAUTION = 19

# ── FIX: Backend push (was missing — signals never reached dashboard) ──
BACKEND_URL  = "http://localhost:8000"
FO_INGEST_EP = f"{BACKEND_URL}/signals/fo_ingest"
_api_sess    = requests.Session()
_api_sess.headers.update({"Content-Type": "application/json"})
_api_ok      = False


def _push(payload: dict, event_type: str = "signal") -> bool:
    """POST signal to backend -> broadcast to all dashboard WS clients."""
    global _api_ok
    try:
        data = {
            "strategy":       payload.get("strategy", "S1 CALENDAR"),
            "instrument":     payload.get("instrument", "BANKNIFTY"),
            "direction":      payload.get("direction", "WAIT"),
            "near_strike":    payload.get("near_strike"),
            "far_strike":     payload.get("far_strike"),
            "spread":         payload.get("spread"),
            "fair_value":     payload.get("fair_value"),
            "deviation":      payload.get("deviation"),
            "score":          payload.get("score", 70),
            "vix":            payload.get("vix"),
            "regime":         payload.get("regime", "LIVE"),
            "risk":           payload.get("risk", "MEDIUM"),
            "source":         payload.get("source", "calendar_algo"),
            "action":         payload.get("action", ""),
            "reason":         payload.get("reason", ""),
            "orders":         payload.get("orders", ""),
            "target_pts":     payload.get("target_pts"),
            "sl_pts":         payload.get("sl_pts"),
            "lots_suggested": payload.get("lots_suggested", 1),
            "near_bid":       payload.get("near_bid"),
            "near_ask":       payload.get("near_ask"),
            "far_bid":        payload.get("far_bid"),
            "buy_far_at":     payload.get("buy_far_at"),
            "sell_near_at":   payload.get("sell_near_at"),
            "event_type":     event_type,
        }
        r = _api_sess.post(FO_INGEST_EP, json=data, timeout=2)
        if r.status_code == 200:
            if not _api_ok:
                print(f"  [{ts()}] [API] Connected — signals live on dashboard")
                _api_ok = True
            return True
        return False
    except requests.exceptions.ConnectionError:
        if _api_ok:
            print(f"  [{ts()}] [API] Backend disconnected (localhost:8000 not reachable)")
            _api_ok = False
        return False
    except Exception:
        return False


# ── Position state ────────────────────────────────────────────
state = {
    "ce_pos": None, "ce_entry": None,
    "pe_pos": None, "pe_entry": None,
    "last_ce": None, "last_pe": None,
    "atm": None, "vix": None,
    "fail": 0, "vix_fail": 0,
}

# ── VIX via NSE public API ────────────────────────────────────
_sess = requests.Session()
_sess.headers.update({
    "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Accept":          "application/json",
    "Referer":         "https://www.nseindia.com",
    "Accept-Language": "en-US,en;q=0.9",
})


def fetch_vix():
    try:
        _sess.get("https://www.nseindia.com", timeout=5)
        r = _sess.get("https://www.nseindia.com/api/allIndices", timeout=5)
        for item in r.json().get("data", []):
            if "INDIA VIX" in str(item.get("index", "")).upper():
                return round(float(item["last"]), 2)
    except Exception:
        pass
    return None


# ── Signal logic ──────────────────────────────────────────────
def get_signal(spread, fair, vix):
    if vix and vix >= VIX_PAUSE:
        return "BLOCKED"
    thr = THRESHOLD if not (vix and vix >= VIX_CAUTION) else round(THRESHOLD * 1.5, 1)
    if spread < fair - thr: return "LONG"
    if spread > fair + thr: return "SHORT"
    return "WAIT"


def check_exit(pos, entry, current):
    pnl = round((current - entry) if pos == "LONG" else (entry - current), 2)
    if pnl >= TARGET:    return "TARGET HIT", pnl
    if pnl <= -STOPLOSS: return "STOPLOSS HIT", pnl
    return None, pnl


def ts():
    return datetime.now().strftime("%H:%M:%S")


def print_banner(atm, vix):
    if   vix and vix >= VIX_PAUSE:   mode = f"PANIC    (VIX={vix})"
    elif vix and vix >= VIX_CAUTION: mode = f"CAUTION  (VIX={vix})"
    else:                             mode = f"NORMAL   (VIX={vix or 'fetching...'})"
    print("\n" + "=" * 60)
    print(f"  BANKNIFTY CALENDAR SPREAD  |  {ts()}")
    print(f"  ATM={atm}  Mode={mode}")
    print(f"  Target={TARGET}pts  SL={STOPLOSS}pts  Threshold={THRESHOLD}pts")
    print("=" * 60 + "\n")


def live_line(label, spread, fair, pos=None, entry=None, vix=None):
    mtm = ""
    if pos and entry is not None:
        pnl = round((spread - entry) if pos == "LONG" else (entry - spread), 2)
        mtm = f"  MTM:{pnl:+.2f}pts [{pos}]"
    dev = round(spread - fair, 2) if fair else 0
    print(f"  [{ts()}] {label}  Spread:{spread:+.2f}  Fair:{fair:+.2f}  Dev:{dev:+.2f}{mtm}")


# ── Startup ───────────────────────────────────────────────────
print("\n" + "=" * 60)
print("  BANKNIFTY CALENDAR SPREAD - LIVE ALGO")
print("=" * 60)
print(f"  XLS      : {XLS_PATH}")
print(f"  Refresh  : {REFRESH}s")
print(f"  Dashboard: {BACKEND_URL}")
print()

_push({"strategy": "S1 CALENDAR", "instrument": "BANKNIFTY",
       "direction": "WAIT", "action": "Calendar algo started",
       "reason": "Connected"}, event_type="signal")

print(f"  [{ts()}] Fetching VIX...")
v = fetch_vix()
if v:
    state["vix"] = v
    print(f"  [{ts()}] VIX = {v}")
else:
    print(f"  [{ts()}] VIX unavailable — will retry.")

prev_atm      = None
cycle         = 0
vix_countdown = 0

while True:
    try:
        cycle         += 1
        vix_countdown += 1

        # Refresh VIX every 20 cycles
        if vix_countdown >= 20:
            v = fetch_vix()
            if v:
                if v != state["vix"]:
                    print(f"\n  [{ts()}] VIX: {state['vix']} -> {v}")
                state["vix"] = v
                state["vix_fail"] = 0
            else:
                state["vix_fail"] += 1
            vix_countdown = 0

        df = loader.get_instruments(XLS_PATH, TEMP_PATH)
        if df is None or df.empty:
            state["fail"] += 1
            if state["fail"] % 5 == 1:
                print(f"  [{ts()}] Waiting for XLS (attempt {state['fail']})...")
            time.sleep(REFRESH)
            continue
        state["fail"] = 0

        atm = loader.get_atm_strike(df)
        if not atm:
            time.sleep(REFRESH)
            continue

        if atm != prev_atm:
            state["atm"] = atm
            prev_atm = atm
            print_banner(atm, state["vix"])

        vix   = state["vix"]
        panic = bool(vix and vix >= VIX_PAUSE)

        # ── CE spread ─────────────────────────────────────────
        ce = loader.get_spread(df, atm, "CE")
        if ce is not None:
            spread = ce["spread"]
            fair   = ce["fair"]
            dev    = round(spread - fair, 2)

            if spread != state["last_ce"]:
                state["last_ce"] = spread
                live_line(f"CE {atm}", spread, fair, state["ce_pos"], state["ce_entry"], vix)
                # FIX: push live CE tick to dashboard
                _push({
                    "strategy": "S1 CALENDAR", "instrument": "BANKNIFTY",
                    "direction": state["ce_pos"] or "WAIT",
                    "near_strike": atm, "far_strike": ce.get("strike", atm),
                    "spread": spread, "fair_value": fair, "deviation": dev,
                    "score": min(95, max(40, 50 + int(abs(dev) * 8))),
                    "vix": vix, "source": "calendar_algo_xls",
                    "action": f"CE {atm} Spread:{spread:+.2f} Dev:{dev:+.2f}",
                    "reason": f"Live CE tick | Dev {dev:+.2f}pts",
                    "near_bid": ce.get("bid"), "near_ask": ce.get("ask"),
                    "far_bid": ce.get("far_leg"),
                    "buy_far_at": ce.get("buy_far_at"),
                    "sell_near_at": ce.get("sell_near_at"),
                    "target_pts": TARGET, "sl_pts": STOPLOSS,
                }, event_type="tick")

            if not panic:
                if state["ce_pos"] is None:
                    sig = get_signal(spread, fair, vix)
                    if sig in ("LONG", "SHORT"):
                        state["ce_pos"]   = sig
                        state["ce_entry"] = spread
                        print(f"\n  [{ts()}] >>> CE {sig} ENTRY @ {spread:+.2f} (Dev {dev:+.2f})")
                        # FIX: push CE entry
                        _push({
                            "strategy": "S1 CALENDAR", "instrument": "BANKNIFTY",
                            "direction": sig,
                            "near_strike": atm, "far_strike": ce.get("strike", atm),
                            "spread": spread, "fair_value": fair, "deviation": dev,
                            "score": min(95, max(65, 65 + int(abs(dev) * 8))),
                            "vix": vix, "source": "calendar_algo_xls",
                            "action": (f"{sig} CE Calendar @ {atm} | "
                                       f"BUY Far@{ce.get('buy_far_at')} "
                                       f"SELL Near@{ce.get('sell_near_at')}"),
                            "reason": f"CE Dev {dev:+.2f}pts > threshold | VIX {vix}",
                            "orders": (f"BUY Far CE {ce.get('strike', atm)} @ {ce.get('buy_far_at')}\n"
                                       f"SELL Near CE {atm} @ {ce.get('sell_near_at')}"),
                            "near_bid": ce.get("bid"), "near_ask": ce.get("ask"),
                            "buy_far_at": ce.get("buy_far_at"),
                            "sell_near_at": ce.get("sell_near_at"),
                            "target_pts": TARGET, "sl_pts": STOPLOSS, "lots_suggested": 1,
                        }, event_type="entry")
                else:
                    reason, pnl = check_exit(state["ce_pos"], state["ce_entry"], spread)
                    if reason:
                        print(f"\n  [{ts()}] <<< CE EXIT {reason} | PnL {pnl:+.2f}pts")
                        # FIX: push CE exit
                        _push({
                            "strategy": "S1 CALENDAR", "instrument": "BANKNIFTY",
                            "direction": f"EXIT {state['ce_pos']}",
                            "near_strike": atm, "spread": spread,
                            "fair_value": fair, "deviation": dev, "score": 80,
                            "vix": vix, "source": "calendar_algo_xls",
                            "action": f"CE EXIT ({reason}) PnL:{pnl:+.2f}pts",
                            "reason": f"{reason} | Entry:{state['ce_entry']:+.2f} -> Exit:{spread:+.2f} = {pnl:+.2f}pts",
                            "target_pts": pnl if pnl > 0 else None,
                            "sl_pts": abs(pnl) if pnl < 0 else None,
                        }, event_type="exit")
                        state["ce_pos"]   = None
                        state["ce_entry"] = None

        # ── PE spread ─────────────────────────────────────────
        pe = loader.get_spread(df, atm, "PE")
        if pe is not None:
            pe_spread = pe["spread"]
            pe_fair   = pe["fair"]
            pe_dev    = round(pe_spread - pe_fair, 2)

            if pe_spread != state["last_pe"]:
                state["last_pe"] = pe_spread
                live_line(f"PE {atm}", pe_spread, pe_fair, state["pe_pos"], state["pe_entry"], vix)
                # FIX: push live PE tick
                _push({
                    "strategy": "S1 CALENDAR", "instrument": "BANKNIFTY",
                    "direction": state["pe_pos"] or "WAIT",
                    "near_strike": atm, "far_strike": pe.get("strike", atm),
                    "spread": pe_spread, "fair_value": pe_fair, "deviation": pe_dev,
                    "score": min(95, max(40, 50 + int(abs(pe_dev) * 8))),
                    "vix": vix, "source": "calendar_algo_xls",
                    "action": f"PE {atm} Spread:{pe_spread:+.2f} Dev:{pe_dev:+.2f}",
                    "reason": f"Live PE tick | Dev {pe_dev:+.2f}pts",
                    "near_bid": pe.get("bid"), "near_ask": pe.get("ask"),
                    "buy_far_at": pe.get("buy_far_at"),
                    "sell_near_at": pe.get("sell_near_at"),
                    "target_pts": TARGET, "sl_pts": STOPLOSS,
                }, event_type="tick")

            if not panic:
                if state["pe_pos"] is None:
                    sig = get_signal(pe_spread, pe_fair, vix)
                    if sig in ("LONG", "SHORT"):
                        state["pe_pos"]   = sig
                        state["pe_entry"] = pe_spread
                        print(f"\n  [{ts()}] >>> PE {sig} ENTRY @ {pe_spread:+.2f} (Dev {pe_dev:+.2f})")
                        # FIX: push PE entry
                        _push({
                            "strategy": "S1 CALENDAR", "instrument": "BANKNIFTY",
                            "direction": sig,
                            "near_strike": atm, "far_strike": pe.get("strike", atm),
                            "spread": pe_spread, "fair_value": pe_fair, "deviation": pe_dev,
                            "score": min(95, max(65, 65 + int(abs(pe_dev) * 8))),
                            "vix": vix, "source": "calendar_algo_xls",
                            "action": (f"{sig} PE Calendar @ {atm} | "
                                       f"BUY Far@{pe.get('buy_far_at')} "
                                       f"SELL Near@{pe.get('sell_near_at')}"),
                            "reason": f"PE Dev {pe_dev:+.2f}pts > threshold | VIX {vix}",
                            "orders": (f"BUY Far PE {pe.get('strike', atm)} @ {pe.get('buy_far_at')}\n"
                                       f"SELL Near PE {atm} @ {pe.get('sell_near_at')}"),
                            "near_bid": pe.get("bid"), "near_ask": pe.get("ask"),
                            "buy_far_at": pe.get("buy_far_at"),
                            "sell_near_at": pe.get("sell_near_at"),
                            "target_pts": TARGET, "sl_pts": STOPLOSS, "lots_suggested": 1,
                        }, event_type="entry")
                else:
                    reason, pnl = check_exit(state["pe_pos"], state["pe_entry"], pe_spread)
                    if reason:
                        print(f"\n  [{ts()}] <<< PE EXIT {reason} | PnL {pnl:+.2f}pts")
                        # FIX: push PE exit
                        _push({
                            "strategy": "S1 CALENDAR", "instrument": "BANKNIFTY",
                            "direction": f"EXIT {state['pe_pos']}",
                            "near_strike": atm, "spread": pe_spread,
                            "fair_value": pe_fair, "deviation": pe_dev, "score": 80,
                            "vix": vix, "source": "calendar_algo_xls",
                            "action": f"PE EXIT ({reason}) PnL:{pnl:+.2f}pts",
                            "reason": f"{reason} | Entry:{state['pe_entry']:+.2f} -> Exit:{pe_spread:+.2f} = {pnl:+.2f}pts",
                            "target_pts": pnl if pnl > 0 else None,
                            "sl_pts": abs(pnl) if pnl < 0 else None,
                        }, event_type="exit")
                        state["pe_pos"]   = None
                        state["pe_entry"] = None

        if vix and VIX_CAUTION <= vix < VIX_PAUSE and cycle % 20 == 0:
            print(f"\n  [{ts()}] VIX={vix} CAUTION — threshold widened to {round(THRESHOLD*1.5,1)}pts")

        time.sleep(REFRESH)

    except KeyboardInterrupt:
        print(f"\n\n  [{ts()}] Algo stopped.")
        if state["ce_pos"]: print(f"    CE {state['atm']} | {state['ce_pos']} @ {state['ce_entry']}")
        if state["pe_pos"]: print(f"    PE {state['atm']} | {state['pe_pos']} @ {state['pe_entry']}")
        if not state["ce_pos"] and not state["pe_pos"]: print("    None — flat.")
        break

    except Exception as e:
        print(f"  [{ts()}] Error: {e}")
        import traceback; traceback.print_exc()
        time.sleep(REFRESH)
