"""Tests for the warranty-status counter used by the quotations list endpoint."""
from datetime import date
from types import SimpleNamespace

from app.quotation.models import WarrantyUnit
from app.quotation.warranty_status import count_warranty_status


def _item(start, count, unit):
    return SimpleNamespace(
        warranty_start=start, warranty_count=count, warranty_unit=unit,
    )


TODAY = date(2026, 5, 8)


def test_no_items_returns_zero_zero():
    assert count_warranty_status([], TODAY) == (0, 0)


def test_items_without_warranty_info_excluded():
    items = [
        _item(None, None, None),
        _item(date(2026, 1, 1), None, None),
        _item(None, 6, WarrantyUnit.month),
    ]
    assert count_warranty_status(items, TODAY) == (0, 0)


def test_active_month():
    # warranty_start 2026-04-01 + 6 months = 2026-10-01 > today
    items = [_item(date(2026, 4, 1), 6, WarrantyUnit.month)]
    assert count_warranty_status(items, TODAY) == (1, 1)


def test_expired_month():
    # warranty_start 2025-01-01 + 6 months = 2025-07-01 < today
    items = [_item(date(2025, 1, 1), 6, WarrantyUnit.month)]
    assert count_warranty_status(items, TODAY) == (0, 1)


def test_active_week():
    # warranty_start today - 1 day + 2 weeks = ~2 weeks future
    items = [_item(date(2026, 5, 7), 2, WarrantyUnit.week)]
    assert count_warranty_status(items, TODAY) == (1, 1)


def test_expired_week():
    # warranty_start 2026-01-01 + 2 weeks = 2026-01-15 < today
    items = [_item(date(2026, 1, 1), 2, WarrantyUnit.week)]
    assert count_warranty_status(items, TODAY) == (0, 1)


def test_mixed_active_and_expired():
    items = [
        _item(date(2026, 4, 1), 6, WarrantyUnit.month),   # active
        _item(date(2025, 1, 1), 3, WarrantyUnit.month),   # expired
        _item(date(2026, 5, 1), 4, WarrantyUnit.week),    # active
        _item(None, None, None),                           # excluded
    ]
    assert count_warranty_status(items, TODAY) == (2, 3)


def test_end_equal_today_counts_as_expired():
    """end_date > today is the active rule. equal-to-today is expired."""
    # 2026-02-08 + 3 months = 2026-05-08 (today). end_date > today is False -> expired.
    items = [_item(date(2026, 2, 8), 3, WarrantyUnit.month)]
    assert count_warranty_status(items, TODAY) == (0, 1)


def test_month_clamps_when_target_day_doesnt_exist():
    """Jan 31 + 1 month should clamp to Feb 28/29, not roll into March."""
    # 2026-01-31 + 1 month = 2026-02-28 (2026 is not a leap year)
    items = [_item(date(2026, 1, 31), 1, WarrantyUnit.month)]
    # 2026-02-28 < 2026-05-08 -> expired
    assert count_warranty_status(items, TODAY) == (0, 1)
