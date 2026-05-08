"""Compute warranty active/expired status for a set of QuotationItems.

Returns (active_count, total_with_warranty_info). An item is counted into
total only when warranty_start AND warranty_count AND warranty_unit are
all set. It's counted into active when end_date > today.

end_date = warranty_start + warranty_count * (week|month).
"""
from __future__ import annotations

from calendar import monthrange
from datetime import date, timedelta
from typing import Iterable, Tuple

from app.quotation.models import QuotationItem, WarrantyUnit


def _add_months(d: date, months: int) -> date:
    """Add months to a date, clamping to the last day of the target month."""
    new_month = d.month + months
    new_year = d.year + (new_month - 1) // 12
    new_month = ((new_month - 1) % 12) + 1
    last_day = monthrange(new_year, new_month)[1]
    new_day = min(d.day, last_day)
    return d.replace(year=new_year, month=new_month, day=new_day)


def count_warranty_status(items: Iterable[QuotationItem], today: date) -> Tuple[int, int]:
    active = 0
    total = 0
    for item in items:
        if (
            item.warranty_start is None
            or item.warranty_count is None
            or item.warranty_unit is None
        ):
            continue
        total += 1
        if item.warranty_unit == WarrantyUnit.month:
            end_date = _add_months(item.warranty_start, item.warranty_count)
        else:
            end_date = item.warranty_start + timedelta(weeks=item.warranty_count)
        if end_date > today:
            active += 1
    return (active, total)
