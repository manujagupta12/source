"""
MULTITRADE XLS LOADER  —  multitrade_loader.py
===============================================
Single source of truth for reading multitrade_feed.xls.
Used by calendar_algo_live.py, multistrategy.py, and the FastAPI backend.

XLS LAYOUT (confirmed from diagnose.py output):
  Row 0-1  : Metadata (expiry labels in NIFTY12MAY2026 format)
  Row 2    : BANKNIFTY spot / expiry / spread metadata
  Row 9    : Header row  —  cols 0-3 are UNLABELLED, cols 4+ labelled
  Row 10+  : Data rows   —  col0=CE/PE, col1=Strike, col4=BID, col5=ASK...

COLUMN MAP (0-indexed, header at row 9):
  [0]  TYPE      CE or PE
  [1]  STRIKE_1  strike integer
  [2]  STRIKE_2  strike integer (duplicate)
  [3]  STRIKE    strike string '53000'
  [4]  BID
  [5]  ASK
  [6]  LTP
  [7]  VOLUME
  [8]  DELTA
  [9]  30 JUN VOL
  [10] 26 MAY VOL
  [11] VOL DIFF
  [12] DELTA 1st
  [13] DELTA 2nd
  [14] VOLUME 2nd
  [15] 1st Vega
  [16] 2nd Vega
  [17] 1st Leg   (near premium)
  [18] 2nd Leg   (far premium)
  [19] Cost
  [20] GAMMA 1ST
  [21] GAMA 2ND
  [22] GAMMA
  [23] TETHA EROD 1ST  (near theta)
  [24] THETA EROD 2ND  (far theta)
  [25] THETA EROD
"""

import os
import shutil
import re
import pandas as pd
import numpy as np
from datetime import datetime, date

# ── File paths ────────────────────────────────────────────────
XLS_PATH  = r"C:\AlgoTrading\data\multitrade_feed.xls"
TEMP_PATH = r"C:\AlgoTrading\data\_temp_read.xls"

HEADER_ROW = 9   # confirmed from diagnose.py

# ── Column name constants (after loading with header=9) ───────
COL_TYPE         = "TYPE"
COL_STRIKE       = "STRIKE_1"
COL_BID          = "BID"
COL_ASK          = "ASK"
COL_LTP          = "LTP"
COL_VOLUME       = "VOLUME"
COL_DELTA        = "DELTA"
COL_FAR_VOL      = "26 MAY VOL"
COL_NEAR_VOL     = "30 JUN VOL"
COL_NEAR_THETA   = "TETHA EROD 1ST"   # note: typo in XLS is intentional
COL_FAR_THETA    = "THETA EROD 2ND"
COL_NEAR_VEGA    = "1st Vega"
COL_FAR_VEGA     = "2nd Vega"
COL_NEAR_DELTA   = "DELTA 1st"
COL_FAR_DELTA    = "DELTA 2nd"
COL_NEAR_LEG     = "1st Leg"           # near premium
COL_FAR_LEG      = "2nd Leg"           # far premium
COL_COST         = "Cost"

# ── Strike range guard ────────────────────────────────────────
STRIKE_MIN = 40000
STRIKE_MAX = 70000


def _f(v):
    """Safe float conversion — returns np.nan on failure."""
    try:
        f = float(v)
        return np.nan if (np.isnan(f) or np.isinf(f)) else f
    except Exception:
        return np.nan


def safe_read(xls_path: str = XLS_PATH,
              temp_path: str = TEMP_PATH) -> pd.DataFrame | None:
    """
    Copy-then-read to avoid PermissionError when Excel has the file open.
    Uses a timestamped temp file to avoid permission conflicts on _temp_read.xls.
    Returns raw DataFrame with header=9, or None on failure.
    """
    import time as _time
    # Use a unique temp name to avoid permission conflicts
    ts_suffix = str(int(_time.time() * 1000) % 100000)
    base = os.path.splitext(temp_path)[0]
    unique_temp = f"{base}_{ts_suffix}.xls"

    try:
        shutil.copy2(xls_path, unique_temp)
    except PermissionError:
        print(f"  [XLS] Source file locked — MultiTrade may be writing")
        return None
    except FileNotFoundError:
        print(f"  [XLS] File not found: {xls_path}")
        return None
    except Exception as e:
        print(f"  [XLS] Copy error: {e}")
        return None

    try:
        df = pd.read_excel(unique_temp, header=HEADER_ROW, engine="xlrd")
        return df
    except Exception as e:
        err = str(e)
        if "BOF" in err or "corrupt" in err.lower() or "format" in err.lower():
            # File was being written mid-copy — silently skip
            pass
        else:
            print(f"  [XLS] Read error: {e}")
        return None
    finally:
        try:
            os.remove(unique_temp)
        except Exception:
            pass


def parse_instruments(df: pd.DataFrame) -> pd.DataFrame | None:
    """
    Parse the raw XLS DataFrame into a clean instruments table.

    Returns DataFrame with columns:
      TYPE, STRIKE, BID, ASK, LTP, VOLUME, DELTA,
      NEAR_THETA, FAR_THETA, NEAR_VEGA, FAR_VEGA,
      NEAR_DELTA, FAR_DELTA, NEAR_LEG, FAR_LEG, COST

    Returns None if the DataFrame is empty or missing required columns.
    """
    if df is None or df.empty:
        return None

    # ── Rename the 4 unlabelled leading columns ───────────────
    cols = list(df.columns)
    cols[0] = "TYPE"
    cols[1] = "STRIKE_1"
    cols[2] = "STRIKE_2"
    cols[3] = "STRIKE_STR"
    df.columns = cols

    # ── Strip whitespace from all column names ────────────────
    df.columns = df.columns.str.strip()

    # ── Keep only CE/PE rows ──────────────────────────────────
    df = df[df["TYPE"].astype(str).str.strip().str.upper().isin(["CE", "PE"])].copy()
    if df.empty:
        return None

    # ── Numeric conversions ───────────────────────────────────
    for col in ["STRIKE_1", "BID", "ASK", "LTP", "VOLUME"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # ── Drop rows with missing strike or bid/ask ──────────────
    df = df.dropna(subset=["STRIKE_1", "BID", "ASK"])

    # ── Filter to valid strike range ──────────────────────────
    df = df[(df["STRIKE_1"] >= STRIKE_MIN) & (df["STRIKE_1"] <= STRIKE_MAX)]

    if df.empty:
        return None

    # ── Normalise TYPE ────────────────────────────────────────
    df["TYPE"] = df["TYPE"].astype(str).str.strip().str.upper()

    # ── Optional Greek columns (present in most rows) ─────────
    greek_map = {
        "NEAR_THETA": COL_NEAR_THETA,
        "FAR_THETA":  COL_FAR_THETA,
        "NEAR_VEGA":  COL_NEAR_VEGA,
        "FAR_VEGA":   COL_FAR_VEGA,
        "NEAR_DELTA": COL_NEAR_DELTA,
        "FAR_DELTA":  COL_FAR_DELTA,
        "NEAR_LEG":   COL_NEAR_LEG,
        "FAR_LEG":    COL_FAR_LEG,
        "COST":       COL_COST,
    }
    for new_name, orig_name in greek_map.items():
        if orig_name in df.columns:
            df[new_name] = pd.to_numeric(df[orig_name], errors="coerce")
        else:
            df[new_name] = np.nan

    # ── Build clean output ────────────────────────────────────
    output_cols = [
        "TYPE", "STRIKE_1", "BID", "ASK", "LTP", "VOLUME",
        "NEAR_THETA", "FAR_THETA", "NEAR_VEGA", "FAR_VEGA",
        "NEAR_DELTA", "FAR_DELTA", "NEAR_LEG", "FAR_LEG", "COST",
    ]
    result = df[[c for c in output_cols if c in df.columns]].copy()
    result = result.rename(columns={"STRIKE_1": "STRIKE"})
    result = result.reset_index(drop=True)

    return result


def get_instruments(xls_path: str = XLS_PATH,
                    temp_path: str = TEMP_PATH) -> pd.DataFrame | None:
    """
    One-call loader: read XLS and return clean instruments DataFrame.
    This is the main public function — use this everywhere.
    """
    raw = safe_read(xls_path, temp_path)
    if raw is None:
        return None
    result = parse_instruments(raw)
    if result is None:
        print(f"  [XLS] File found but 0 instruments — check XLS is updated")
        return None
    return result


def get_ce(df: pd.DataFrame) -> pd.DataFrame:
    """Filter to CE rows only."""
    return df[df["TYPE"] == "CE"].copy().reset_index(drop=True)


def get_pe(df: pd.DataFrame) -> pd.DataFrame:
    """Filter to PE rows only."""
    return df[df["TYPE"] == "PE"].copy().reset_index(drop=True)


def get_atm_strike(df: pd.DataFrame, spot: float = None) -> int | None:
    """
    Auto-detect ATM strike.
    If spot is given, rounds to nearest 100 and finds closest available.
    Fallback: highest volume CE strike.
    """
    ce = get_ce(df)
    if ce.empty:
        return None

    strikes = sorted(ce["STRIKE"].dropna().astype(int).unique())
    if not strikes:
        return None

    if spot and STRIKE_MIN < spot < STRIKE_MAX:
        # Round spot to nearest 100 (BANKNIFTY) or 50 (NIFTY)
        # Try 100 first (BANKNIFTY), then 50 (NIFTY)
        for step in [100, 50]:
            atm_rounded = int(round(spot / step) * step)
            if atm_rounded in strikes:
                return atm_rounded
        return min(strikes, key=lambda s: abs(s - spot))

    # Fallback: highest volume
    vol_col = "VOLUME" if "VOLUME" in ce.columns else None
    if vol_col:
        ce["VOLUME"] = pd.to_numeric(ce["VOLUME"], errors="coerce")
        idx = ce["VOLUME"].idxmax()
        return int(ce.loc[idx, "STRIKE"])

    return strikes[len(strikes) // 2]


def get_spread(df: pd.DataFrame, strike: int,
               option_type: str = "CE") -> dict | None:
    """
    Calculate calendar spread for a given strike and option type.
    If exact strike not found, tries the nearest available strike.

    Calendar Spread = Far Leg (2nd Leg) BID - Near Leg ASK
    Fair Value      = (Far Theta - Near Theta) × 0.5

    Returns dict with spread, fair, deviation, and all order prices.
    Returns None if data is missing.
    """
    rows = df[(df["STRIKE"] == strike) & (df["TYPE"] == option_type)]

    # If exact strike missing, find nearest available for this option type
    if rows.empty:
        avail = df[df["TYPE"] == option_type]["STRIKE"].dropna().astype(int).unique()
        if len(avail) == 0:
            return None
        nearest = int(min(avail, key=lambda s: abs(s - strike)))
        rows = df[(df["STRIKE"] == nearest) & (df["TYPE"] == option_type)]
        if rows.empty:
            return None
        strike = nearest  # use nearest strike

    row = rows.iloc[0]

    bid      = _f(row.get("BID", np.nan))
    ask      = _f(row.get("ASK", np.nan))
    ltp      = _f(row.get("LTP", np.nan))
    near_leg = _f(row.get("NEAR_LEG", np.nan))   # near premium
    far_leg  = _f(row.get("FAR_LEG", np.nan))    # far premium
    nt       = _f(row.get("NEAR_THETA", np.nan))
    ft       = _f(row.get("FAR_THETA", np.nan))
    nv       = _f(row.get("NEAR_VEGA", np.nan))
    fv       = _f(row.get("FAR_VEGA", np.nan))
    nd       = _f(row.get("NEAR_DELTA", np.nan))
    fd       = _f(row.get("FAR_DELTA", np.nan))
    cost     = _f(row.get("COST", np.nan))
    volume   = _f(row.get("VOLUME", np.nan))

    # Calendar spread = far bid minus near ask
    # Use NEAR_LEG/FAR_LEG columns (most accurate) with BID/ASK fallback
    near_ask_for_spread = ask if np.isnan(near_leg) else near_leg
    far_bid_for_spread  = bid if np.isnan(far_leg)  else far_leg

    if np.isnan(near_ask_for_spread) or np.isnan(far_bid_for_spread):
        return None

    spread = round(far_bid_for_spread - near_ask_for_spread, 2)

    # Fair value from theta differential
    fair = 0.0
    if not (np.isnan(nt) or np.isnan(ft)):
        fair = round((ft - nt) * 0.5, 2)

    deviation = round(spread - fair, 2)

    # Order prices (limit order execution prices)
    near_bid_px  = bid  if not np.isnan(bid)  else near_ask_for_spread - 0.05
    near_ask_px  = ask  if not np.isnan(ask)  else near_ask_for_spread
    far_bid_px   = far_bid_for_spread
    far_ask_px   = far_bid_px + 0.10

    return {
        "strike":       strike,
        "type":         option_type,
        "bid":          round(near_bid_px, 2),
        "ask":          round(near_ask_px, 2),
        "ltp":          round(ltp, 2) if not np.isnan(ltp) else None,
        "volume":       int(volume) if not np.isnan(volume) else 0,
        "near_leg":     round(near_leg, 2) if not np.isnan(near_leg) else None,
        "far_leg":      round(far_leg, 2)  if not np.isnan(far_leg)  else None,
        "spread":       spread,
        "fair":         fair,
        "deviation":    deviation,
        "near_theta":   round(nt, 4) if not np.isnan(nt) else None,
        "far_theta":    round(ft, 4) if not np.isnan(ft) else None,
        "near_vega":    round(nv, 4) if not np.isnan(nv) else None,
        "far_vega":     round(fv, 4) if not np.isnan(fv) else None,
        "near_delta":   round(nd, 4) if not np.isnan(nd) else None,
        "far_delta":    round(fd, 4) if not np.isnan(fd) else None,
        "cost":         round(cost, 2) if not np.isnan(cost) else None,
        # Explicit far bid/ask (used by Calendaralgofinal.py display)
        "far_bid":      round(far_bid_for_spread, 2),
        "far_ask":      round(far_bid_for_spread + 0.10, 2),
        # Limit order prices for execution
        "sell_near_at": round(near_bid_px - 0.05, 2),
        "buy_near_at":  round(near_ask_px + 0.05, 2),
        "buy_far_at":   round(far_bid_px  + 0.05, 2),
        "sell_far_at":  round(far_bid_px  - 0.05, 2),
    }


def get_straddle_premium(df: pd.DataFrame, strike: int) -> float | None:
    """
    Straddle = CE LTP + PE LTP at the same strike.
    Used by S3 Short Straddle and S6 Expiry 0DTE.
    """
    ce_row = df[(df["STRIKE"] == strike) & (df["TYPE"] == "CE")]
    pe_row = df[(df["STRIKE"] == strike) & (df["TYPE"] == "PE")]
    if ce_row.empty or pe_row.empty:
        return None
    try:
        ce_ltp = _f(ce_row.iloc[0].get("LTP", np.nan))
        pe_ltp = _f(pe_row.iloc[0].get("LTP", np.nan))
        if np.isnan(ce_ltp) or np.isnan(pe_ltp):
            return None
        return round(ce_ltp + pe_ltp, 2)
    except Exception:
        return None


def summary(df: pd.DataFrame) -> dict:
    """Quick stats for logging/debugging."""
    if df is None or df.empty:
        return {"total": 0, "ce": 0, "pe": 0, "strikes": []}
    ce = get_ce(df)
    pe = get_pe(df)
    return {
        "total":   len(df),
        "ce":      len(ce),
        "pe":      len(pe),
        "strikes": sorted(df["STRIKE"].dropna().astype(int).unique().tolist()),
        "strike_range": f"{df['STRIKE'].min():.0f} — {df['STRIKE'].max():.0f}",
    }


# ── Quick test ────────────────────────────────────────────────
if __name__ == "__main__":
    import sys
    path = sys.argv[1] if len(sys.argv) > 1 else XLS_PATH
    print(f"\nTesting multitrade_loader.py with: {path}\n")

    df = get_instruments(path, path + ".tmp")
    if df is None:
        print("  FAILED — 0 instruments loaded")
        sys.exit(1)

    info = summary(df)
    print(f"  ✅ Loaded {info['total']} instruments "
          f"({info['ce']} CE / {info['pe']} PE)")
    print(f"  Strike range: {info['strike_range']}")
    print(f"  First 5 strikes: {info['strikes'][:5]}")

    atm = get_atm_strike(df)
    print(f"\n  ATM strike (by volume): {atm}")

    if atm:
        ce_spread = get_spread(df, atm, "CE")
        pe_spread = get_spread(df, atm, "PE")
        if ce_spread:
            print(f"\n  CE {atm} Spread: {ce_spread['spread']:+.2f}  "
                  f"Fair: {ce_spread['fair']:+.2f}  "
                  f"Dev: {ce_spread['deviation']:+.2f}")
            print(f"    BUY Far @ {ce_spread['buy_far_at']}  "
                  f"SELL Near @ {ce_spread['sell_near_at']}")
        if pe_spread:
            print(f"\n  PE {atm} Spread: {pe_spread['spread']:+.2f}  "
                  f"Fair: {pe_spread['fair']:+.2f}  "
                  f"Dev: {pe_spread['deviation']:+.2f}")

    straddle = get_straddle_premium(df, atm) if atm else None
    if straddle:
        print(f"\n  Straddle at {atm}: {straddle:.2f}")

    print("\n  Test complete.")