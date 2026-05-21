"""
PATCH: Adds market="FO" to _mock_signal() and _xls_signal().

Root cause of blank F&O dashboard:
  - _mock_signal() never set the 'market' field
  - Frontend SignalsTab filters by s.market.toUpperCase() === market
  - So all mock F&O signals were invisible under every market filter
    except "All Markets"

Apply this patch to main.py:

In _mock_signal(), add to the returned dict:
    "market": "FO",

In _xls_signal(), add to the sig dict:
    "market": "FO",

Both already done in this commit via the patched main.py below.
This file is a documentation marker only.
"""

PATCH_DESCRIPTION = """
FILE: app/backend/main.py

CHANGE 1 — _mock_signal() return dict, add after "source": "mock":
    "market": "FO",

CHANGE 2 — _xls_signal() sig dict, add after "source": "xls_live":
    "market": "FO",

These two one-line additions make all F&O signals visible on the dashboard.
"""
