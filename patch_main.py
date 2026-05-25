"""
patch_main.py  —  run once from repo root to fix main.py
  python patch_main.py

Fixes:
  1. _mock_signal()  — adds "market": "FO"
  2. _xls_signal()   — adds "market": "FO"
"""

import sys
from pathlib import Path

TARGET = Path("app/backend/main.py")

if not TARGET.exists():
    sys.exit(f"ERROR: {TARGET} not found. Run from repo root.")

src = TARGET.read_text(encoding="utf-8")
original = src

# ── Fix 1: _mock_signal() — add market="FO" ─────────────────
OLD1 = (
    '        "timestamp": datetime.now().isoformat(), "source": "mock",\n'
    '        "strategy": strat, "score": score, "direction": dirn,'
)
NEW1 = (
    '        "timestamp": datetime.now().isoformat(), "source": "mock",\n'
    '        "market": "FO",\n'
    '        "strategy": strat, "score": score, "direction": dirn,'
)

# ── Fix 2: _xls_signal() — add market="FO" ──────────────────
OLD2 = (
    '            "timestamp": datetime.now().isoformat(), "source": "xls_live",\n'
    '            "strategy": "S1 CALENDAR", "score": score, "direction": dirn,'
)
NEW2 = (
    '            "timestamp": datetime.now().isoformat(), "source": "xls_live",\n'
    '            "market": "FO",\n'
    '            "strategy": "S1 CALENDAR", "score": score, "direction": dirn,'
)

fixes = [
    ("Fix 1 - mock signal market=FO",  OLD1, NEW1),
    ("Fix 2 - xls signal market=FO",   OLD2, NEW2),
]

for name, old, new in fixes:
    if old in src:
        src = src.replace(old, new, 1)
        print(f"  [OK] {name}")
    elif new in src:
        print(f"  [SKIP] {name} — already applied")
    else:
        # Fallback: try to find the function and patch it with regex
        print(f"  [WARN] {name} — exact pattern not found, trying fallback...")
        import re
        if "Fix 1" in name:
            # Find _mock_signal return dict and inject market field
            pattern = r'(def _mock_signal\(\):.*?return \{)(.*?)(\"strategy\": strat)'
            match = re.search(pattern, src, re.DOTALL)
            if match and '"market": "FO"' not in src[match.start():match.end()]:
                insert_at = match.start(3)
                src = src[:insert_at] + '"market": "FO",\n        ' + src[insert_at:]
                print(f"  [OK] {name} (fallback regex)")
            else:
                print(f"  [SKIP or ALREADY DONE] {name}")
        elif "Fix 2" in name:
            pattern = r'(def _xls_signal\(\):.*?sig = \{)(.*?)(\"strategy\": \"S1 CALENDAR\")'
            match = re.search(pattern, src, re.DOTALL)
            if match and '"market": "FO"' not in src[match.start():match.end()]:
                insert_at = match.start(3)
                src = src[:insert_at] + '"market": "FO",\n            ' + src[insert_at:]
                print(f"  [OK] {name} (fallback regex)")
            else:
                print(f"  [SKIP or ALREADY DONE] {name}")

if src != original:
    TARGET.write_text(src, encoding="utf-8")
    print(f"\n  Saved {TARGET}")
    print("  Now restart backend: cd app/backend && python main.py")
else:
    print("\n  No changes needed — already patched.")
