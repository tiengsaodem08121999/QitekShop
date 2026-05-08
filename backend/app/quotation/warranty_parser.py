"""Parse a free-text warranty string into (count, unit, reason).

Used by:
  - alembic migration <rev>_split_warranty_column.py for backfilling legacy rows
  - unit tests (test_warranty_parser.py)

The parser is intentionally a pure function with no SQLAlchemy / model coupling
so the migration can import it without dragging in the rest of the app.

Return shape: (count, unit, reason)
  - On success: (int, "month"|"week", None)
  - On expected-empty input (None or whitespace-only): (None, None, None)
  - On unparseable input: (None, None, "<reason>") where reason is one of:
      "no_match", "unknown_suffix", "count_out_of_range"

A bare number with no suffix (e.g. "6") defaults to "month" — every legacy
bare-number-like value in this dataset is months.
"""
from __future__ import annotations

import re
from typing import Optional, Tuple

_PATTERN = re.compile(r"^(\d+)\s*([a-zA-ZÀ-ỹ]*)$")

_MONTH_SUFFIXES = {
    "", "th", "t", "thang", "tháng",
    "m", "mo", "month", "months",
}
_WEEK_SUFFIXES = {
    "tuan", "tuần",
    "w", "wk", "week", "weeks",
}

MIN_COUNT = 1
MAX_COUNT = 99


def parse_warranty(raw: Optional[str]) -> Tuple[Optional[int], Optional[str], Optional[str]]:
    if raw is None:
        return (None, None, None)
    s = raw.strip()
    if s == "":
        return (None, None, None)

    s_lower = s.lower()
    m = _PATTERN.match(s_lower)
    if not m:
        return (None, None, "no_match")

    count = int(m.group(1))
    suffix = m.group(2)

    if suffix in _MONTH_SUFFIXES:
        unit = "month"
    elif suffix in _WEEK_SUFFIXES:
        unit = "week"
    else:
        return (None, None, "unknown_suffix")

    if not (MIN_COUNT <= count <= MAX_COUNT):
        return (None, None, "count_out_of_range")

    return (count, unit, None)
