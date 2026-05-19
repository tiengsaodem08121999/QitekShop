"""Tests for quotation service: resale-price-aware profit and update_item_resale."""
from decimal import Decimal

import pytest

from datetime import date as _date

from app.quotation.models import (
    Customer,
    Payment,
    PaymentMethod,
    PaymentType,
    Quotation,
    QuotationItem,
    QuotationStatus,
)
from app.quotation.service import enrich_response, update_item_resale


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


def test_enrich_response_profit_is_total_amount_minus_purchase(db_session, admin_user):
    """Profit = total_amount - total_purchase. Trade-in and resale are tracked
    separately in cashflow and do not affect profit.
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
    assert data["profit"] == Decimal(200_000)


def test_enrich_response_cashflow_formula(db_session, admin_user):
    """Cashflow = cash NET đã thực chảy = (paid − refund_paid) + resale − purchase.

    With cost=800K, trade-in=600K, resale=800K, no payments:
      cashflow = 0 − 0 + 800K − 800K = 0
      remaining = 1M − 600K = 400K (khách còn nợ, chưa chảy)
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
    assert data["remaining"] == Decimal(400_000)
    assert data["cashflow"] == Decimal(0)


def test_cashflow_excludes_unrefunded_return(db_session, admin_user):
    """Return chưa refund_paid không trừ cashflow — chưa có cash event."""
    q = _seed_quotation(
        db_session,
        user_id=admin_user.id,
        items=[
            {"is_trade_in": False, "name": "Ram 16gb", "purchase_price": 800_000, "selling_price": 1_000_000},
        ],
    )
    q.total_amount = Decimal(1_000_000)
    db_session.flush()

    # Khách trả 1M
    db_session.add(Payment(
        quotation_id=q.id, amount=Decimal(1_000_000), method=PaymentMethod.cash,
        payment_type=PaymentType.payment, date=_date(2026, 5, 1), created_by=admin_user.id,
    ))
    # Ghi nhận return 200K nhưng chưa thực sự hoàn tiền
    from app.quotation.models import Return, ReturnReason
    db_session.add(Return(
        quotation_id=q.id, item_name="Ram 16gb", reason=ReturnReason.seller_fault,
        selling_price=Decimal(1_000_000), refund_percent=20, refund_amount=Decimal(200_000),
        date=_date(2026, 5, 2), created_by=admin_user.id,
    ))
    db_session.flush()
    db_session.refresh(q)

    data = enrich_response(q)
    # cashflow = 1M − 0 + 0 − 800K = 200K
    assert data["cashflow"] == Decimal(200_000)
    assert data["total_refund"] == Decimal(200_000)
    assert data["total_refund_paid"] == Decimal(0)


def test_cashflow_subtracts_paid_refund(db_session, admin_user):
    """Refund đã pay trừ vào cashflow vì cash thực sự ra khỏi két."""
    q = _seed_quotation(
        db_session,
        user_id=admin_user.id,
        items=[
            {"is_trade_in": False, "name": "Ram 16gb", "purchase_price": 800_000, "selling_price": 1_000_000},
        ],
    )
    q.total_amount = Decimal(1_000_000)
    db_session.flush()

    db_session.add_all([
        Payment(quotation_id=q.id, amount=Decimal(1_000_000), method=PaymentMethod.cash,
                payment_type=PaymentType.payment, date=_date(2026, 5, 1), created_by=admin_user.id),
        Payment(quotation_id=q.id, amount=Decimal(200_000), method=PaymentMethod.cash,
                payment_type=PaymentType.refund, date=_date(2026, 5, 3), created_by=admin_user.id),
    ])
    db_session.flush()
    db_session.refresh(q)

    data = enrich_response(q)
    # cashflow = 1M − 200K + 0 − 800K = 0
    assert data["cashflow"] == Decimal(0)


def test_enrich_response_total_paid_computed_from_payments(db_session, admin_user):
    """total_paid is no longer denormalized — it must be summed live from
    payments (type='payment'), excluding refunds. Verifies the compute-on-read
    path after dropping the quotations.total_paid column.
    """
    q = _seed_quotation(
        db_session,
        user_id=admin_user.id,
        items=[
            {"is_trade_in": False, "name": "Ram 16gb", "purchase_price": 800_000, "selling_price": 1_000_000},
        ],
    )
    q.total_amount = Decimal(1_000_000)
    db_session.flush()

    db_session.add_all([
        Payment(quotation_id=q.id, amount=Decimal(300_000), method=PaymentMethod.cash,
                payment_type=PaymentType.payment, date=_date(2026, 5, 1), created_by=admin_user.id),
        Payment(quotation_id=q.id, amount=Decimal(200_000), method=PaymentMethod.transfer,
                payment_type=PaymentType.payment, date=_date(2026, 5, 2), created_by=admin_user.id),
        Payment(quotation_id=q.id, amount=Decimal(50_000), method=PaymentMethod.cash,
                payment_type=PaymentType.refund, date=_date(2026, 5, 3), created_by=admin_user.id),
    ])
    db_session.flush()
    db_session.refresh(q)

    data = enrich_response(q)
    # Only payment-type rows count toward total_paid; refunds tracked separately
    assert data["total_paid"] == Decimal(500_000)
    assert data["total_refund_paid"] == Decimal(50_000)
    # remaining = 1M - 0 - 0 - (500K - 50K) = 550K
    assert data["remaining"] == Decimal(550_000)


def test_update_item_resale_sets_price(db_session, admin_user):
    q = _seed_quotation(
        db_session,
        user_id=admin_user.id,
        items=[{"is_trade_in": True, "name": "Ram 8gb", "purchase_price": 600_000}],
    )
    item_id = q.items[0].id

    updated = update_item_resale(db_session, q.id, item_id, Decimal(800_000))
    assert updated is not None
    assert updated.items[0].resale_price == Decimal(800_000)


def test_update_item_resale_works_on_confirmed_quotation(db_session, admin_user):
    """Trade-in resale recording must work after the quotation is confirmed."""
    q = _seed_quotation(
        db_session,
        user_id=admin_user.id,
        items=[{"is_trade_in": True, "name": "Ram 8gb", "purchase_price": 600_000}],
    )
    q.status = QuotationStatus.confirmed
    db_session.flush()
    item_id = q.items[0].id

    updated = update_item_resale(db_session, q.id, item_id, Decimal(800_000))
    assert updated is not None
    assert updated.items[0].resale_price == Decimal(800_000)
    assert updated.status == QuotationStatus.confirmed


def test_update_item_resale_rejects_non_trade_in(db_session, admin_user):
    """resale_price only makes sense on trade-in items."""
    q = _seed_quotation(
        db_session,
        user_id=admin_user.id,
        items=[{"is_trade_in": False, "name": "Ram 16gb", "selling_price": 1_000_000}],
    )
    item_id = q.items[0].id

    with pytest.raises(ValueError, match="trade-in"):
        update_item_resale(db_session, q.id, item_id, Decimal(800_000))


def test_update_item_resale_returns_none_for_unknown_item(db_session, admin_user):
    q = _seed_quotation(
        db_session,
        user_id=admin_user.id,
        items=[{"is_trade_in": True, "name": "Ram 8gb", "purchase_price": 600_000}],
    )

    result = update_item_resale(db_session, q.id, 9999, Decimal(800_000))
    assert result is None
