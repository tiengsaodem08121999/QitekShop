"""Sales profit per month = selling − purchase of goods sold, counting each stock
item once whether it went out through a quotation or a Finance sale."""
from datetime import date

from app.dashboard_service import get_yearly_sales_profit
from app.finance.models import Transaction, TransactionType
from app.inventory.models import InventoryItem, InventoryStatus
from app.quotation.models import Customer, Quotation, QuotationItem, QuotationStatus


def _quotation(db, user_id, status, delivered_at=None):
    cust = Customer(name="A")
    db.add(cust)
    db.flush()
    q = Quotation(customer_id=cust.id, status=status, delivered_at=delivered_at, created_by=user_id)
    db.add(q)
    db.flush()
    return q


def _line(db, q, sell, cost, trade_in=False, inv_id=None):
    db.add(QuotationItem(quotation_id=q.id, is_trade_in=trade_in, name="X",
                         selling_price=sell, purchase_price=cost, inventory_item_id=inv_id))


def _direct_sale(db, user_id, day, sell, cost, deleted=False):
    txn = Transaction(date=day, description="sale", type=TransactionType.thu, amount=sell,
                      created_by=user_id, is_deleted=deleted)
    db.add(txn)
    db.flush()
    inv = InventoryItem(name="Y", purchase_price=cost, selling_price=sell,
                        status=InventoryStatus.sold, transaction_id=txn.id)
    db.add(inv)
    db.flush()
    return inv


def _month(series, m):
    return next(s for s in series if s["month"] == m)


def test_delivered_quotation_counts_in_delivery_month(db_session, sales_user):
    q = _quotation(db_session, sales_user.id, QuotationStatus.delivered, date(2026, 3, 5))
    _line(db_session, q, 1000, 700)
    _line(db_session, q, 500, 400)
    _line(db_session, q, 0, 300, trade_in=True)  # trade-in: not a sale
    db_session.commit()
    m = _month(get_yearly_sales_profit(db_session, 2026), 3)
    assert (m["revenue"], m["cost"], m["profit"], m["quotation_profit"]) == (1500, 1100, 400, 400)


def test_undelivered_and_other_year_quotations_are_ignored(db_session, sales_user):
    _line(db_session, _quotation(db_session, sales_user.id, QuotationStatus.confirmed), 1000, 500)
    _line(db_session, _quotation(db_session, sales_user.id, QuotationStatus.delivered, date(2025, 3, 1)), 1000, 500)
    db_session.commit()
    assert all(s["profit"] == 0 for s in get_yearly_sales_profit(db_session, 2026))


def test_direct_finance_sale_counts_on_transaction_date(db_session, sales_user):
    _direct_sale(db_session, sales_user.id, date(2026, 4, 10), 900, 600)
    _direct_sale(db_session, sales_user.id, date(2026, 4, 11), 900, 100, deleted=True)
    db_session.commit()
    m = _month(get_yearly_sales_profit(db_session, 2026), 4)
    assert (m["profit"], m["direct_profit"], m["quotation_profit"]) == (300, 300, 0)


def test_stock_item_sold_through_finance_is_not_counted_again_via_quotation(db_session, sales_user):
    inv = _direct_sale(db_session, sales_user.id, date(2026, 5, 2), 900, 600)
    q = _quotation(db_session, sales_user.id, QuotationStatus.delivered, date(2026, 5, 20))
    _line(db_session, q, 950, 600, inv_id=inv.id)
    db_session.commit()
    m = _month(get_yearly_sales_profit(db_session, 2026), 5)
    assert (m["profit"], m["direct_profit"], m["quotation_profit"]) == (300, 300, 0)


def test_deliver_sets_delivered_at(client, sales_user, db_session):
    from conftest import auth_headers
    inv = InventoryItem(name="Z", purchase_price=100, status=InventoryStatus.in_stock)
    db_session.add(inv)
    db_session.flush()
    q = _quotation(db_session, sales_user.id, QuotationStatus.confirmed)
    _line(db_session, q, 200, 100, inv_id=inv.id)
    db_session.commit()
    resp = client.patch(f"/api/quotations/{q.id}/deliver", headers=auth_headers(sales_user))
    assert resp.status_code == 200, resp.text
    db_session.expire_all()
    assert db_session.get(Quotation, q.id).delivered_at == date.today()
