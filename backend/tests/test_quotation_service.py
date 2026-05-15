"""Tests for quotation service: resale-price-aware profit and update_item_resale."""
from decimal import Decimal

import pytest

from app.quotation.models import Customer, Quotation, QuotationItem


def _seed_quotation(db_session, *, user_id: int = 1, items: list[dict] | None = None):
    """Helper: create a customer + quotation + items, return the persisted Quotation."""
    customer = Customer(name="Acme")
    db_session.add(customer)
    db_session.flush()
    q = Quotation(customer_id=customer.id, created_by=user_id)
    db_session.add(q)
    db_session.flush()
    for it in items or []:
        db_session.add(QuotationItem(quotation_id=q.id, **it))
    db_session.flush()
    return q


def test_quotation_item_has_resale_price_default_zero(db_session, admin_user):
    """resale_price defaults to 0 when not specified."""
    q = _seed_quotation(
        db_session,
        user_id=admin_user.id,
        items=[{"is_trade_in": True, "name": "Ram 8gb", "purchase_price": 600_000}],
    )
    item = q.items[0]
    assert item.resale_price == Decimal(0)
