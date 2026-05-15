"""Tests for quotation service: resale-price-aware profit and update_item_resale."""
from decimal import Decimal

import pytest

from app.quotation.models import Customer, Quotation, QuotationItem
from app.quotation.service import enrich_response


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


def test_enrich_response_includes_total_trade_in_resale(db_session, admin_user):
    q = _seed_quotation(
        db_session,
        user_id=admin_user.id,
        items=[
            {"is_trade_in": False, "name": "Ram 16gb", "purchase_price": 800_000, "selling_price": 1_000_000},
            {"is_trade_in": True, "name": "Ram 8gb", "purchase_price": 600_000, "resale_price": 800_000},
        ],
    )
    q.total_amount = Decimal(1_000_000)
    q.total_trade_in = Decimal(600_000)
    db_session.flush()

    data = enrich_response(q)
    assert data["total_trade_in_resale"] == Decimal(800_000)


def test_enrich_response_profit_includes_resale(db_session, admin_user):
    """Profit = total_amount - total_purchase - total_trade_in + total_trade_in_resale - total_refund

    Concrete: sold 16gb for 1,000,000 (cost 800,000), accepted 8gb trade-in
    for 600,000, later resold 8gb for 800,000. Profit should be 400,000.
    """
    q = _seed_quotation(
        db_session,
        user_id=admin_user.id,
        items=[
            {"is_trade_in": False, "name": "Ram 16gb", "purchase_price": 800_000, "selling_price": 1_000_000},
            {"is_trade_in": True, "name": "Ram 8gb", "purchase_price": 600_000, "resale_price": 800_000},
        ],
    )
    q.total_amount = Decimal(1_000_000)
    q.total_trade_in = Decimal(600_000)
    db_session.flush()

    data = enrich_response(q)
    assert data["profit"] == Decimal(400_000)


def test_enrich_response_profit_unchanged_when_resale_zero(db_session, admin_user):
    """resale_price=0 yields the same profit as before this feature."""
    q = _seed_quotation(
        db_session,
        user_id=admin_user.id,
        items=[
            {"is_trade_in": False, "name": "Ram 16gb", "purchase_price": 800_000, "selling_price": 1_000_000},
            {"is_trade_in": True, "name": "Ram 8gb", "purchase_price": 600_000, "resale_price": 0},
        ],
    )
    q.total_amount = Decimal(1_000_000)
    q.total_trade_in = Decimal(600_000)
    db_session.flush()

    data = enrich_response(q)
    # 1,000,000 - 800,000 - 600,000 + 0 - 0 = -400,000
    assert data["profit"] == Decimal(-400_000)
    assert data["total_trade_in_resale"] == Decimal(0)
