"""
patch_main.py  —  run once from repo root
  python patch_main.py
"""
import sys
from pathlib import Path

TARGET = Path("app/backend/main.py")
if not TARGET.exists():
    sys.exit(f"ERROR: {TARGET} not found. Run from repo root.")

src = TARGET.read_text(encoding="utf-8")

# ── The exact block we want to replace in _mock_signal() ─────
OLD_MOCK = '''    return {
        "timestamp": datetime.now().isoformat(), "source": "mock",
        "strategy": strat, "score": score, "direction": dirn,
        "instrument": "BANKNIFTY", "near_strike": atm, "far_strike": atm,'''

NEW_MOCK = '''    return {
        "timestamp": datetime.now().isoformat(), "source": "mock",
        "market": "FO",
        "strategy": strat, "score": score, "direction": dirn,
        "instrument": "BANKNIFTY", "near_strike": atm, "far_strike": atm,'''

# ── The exact block we want to replace in _xls_signal() ──────
OLD_XLS = '''        sig = {
            "timestamp": datetime.now().isoformat(), "source": "xls_live",
            "strategy": "S1 CALENDAR", "score": score, "direction": dirn,
            "instrument": "BANKNIFTY", "near_strike": atm, "far_strike": atm,'''

NEW_XLS = '''        sig = {
            "timestamp": datetime.now().isoformat(), "source": "xls_live",
            "market": "FO",
            "strategy": "S1 CALENDAR", "score": score, "direction": dirn,
            "instrument": "BANKNIFTY", "near_strike": atm, "far_strike": atm,'''

changed = False

if OLD_MOCK in src:
    src = src.replace(OLD_MOCK, NEW_MOCK, 1)
    print("  [OK] _mock_signal() — market=FO added")
    changed = True
elif NEW_MOCK in src:
    print("  [SKIP] _mock_signal() — already has market=FO")
else:
    print("  [FAIL] _mock_signal() — pattern not found")

if OLD_XLS in src:
    src = src.replace(OLD_XLS, NEW_XLS, 1)
    print("  [OK] _xls_signal() — market=FO added")
    changed = True
elif NEW_XLS in src:
    print("  [SKIP] _xls_signal() — already has market=FO")
else:
    print("  [FAIL] _xls_signal() — pattern not found")

if changed:
    TARGET.write_text(src, encoding="utf-8")
    print(f"\n  Saved {TARGET}")
    print("  Restart: cd app/backend && python main.py")
else:
    print("\n  Nothing to do.")
