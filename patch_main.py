"""
patch_main.py  —  run once from repo root to fix main.py
  python patch_main.py

Fixes applied:
  1. _mock_signal()  — adds  "market": "FO"
  2. _xls_signal()   — adds  "market": "FO"
  3. _fetch_live_indices() — adds random fluctuation so indices ticker moves
"""

import re, sys
from pathlib import Path

TARGET = Path("app/backend/main.py")

if not TARGET.exists():
    sys.exit(f"ERROR: {TARGET} not found. Run from repo root.")

src = TARGET.read_text(encoding="utf-8")
original = src

# ── Fix 1: _mock_signal() — add market="FO" after "source": "mock" ──────────
OLD1 = '''        "timestamp": datetime.now().isoformat(), "source": "mock",
        "strategy": strat'''
NEW1 = '''        "timestamp": datetime.now().isoformat(), "source": "mock",
        "market":    "FO",
        "strategy": strat'''

# ── Fix 2: _xls_signal() — add market="FO" after "source": "xls_live" ───────
OLD2 = '''            "timestamp": datetime.now().isoformat(), "source": "xls_live",
            "strategy": "S1 CALENDAR"'''
NEW2 = '''            "timestamp": datetime.now().isoformat(), "source": "xls_live",
            "market":   "FO",
            "strategy": "S1 CALENDAR"'''

# ── Fix 3: index fallback — add tiny random delta so ticker fluctuates ───────
OLD3 = '''                "ltp":        round(base + random.uniform(-base * 0.005, base * 0.005), 2),'''
NEW3 = '''                "ltp":        round(base + random.uniform(-base * 0.008, base * 0.008), 2),'''

fixes = [
    ("Fix 1 - mock signal market=FO",  OLD1, NEW1),
    ("Fix 2 - xls signal market=FO",   OLD2, NEW2),
    ("Fix 3 - index fluctuation range", OLD3, NEW3),
]

for name, old, new in fixes:
    if old in src:
        src = src.replace(old, new, 1)
        print(f"  [OK] {name}")
    elif new in src:
        print(f"  [SKIP] {name} — already applied")
    else:
        print(f"  [WARN] {name} — pattern not found, check manually")

if src != original:
    TARGET.write_text(src, encoding="utf-8")
    print(f"\n  Saved {TARGET}")
    print("  Restart backend: cd app/backend && python main.py")
else:
    print("\n  No changes made.")
