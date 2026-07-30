"""Delete (= cancel) releases/reclaims stock; delivered quotations lock item edits."""
from conftest import auth_headers

from app.inventory.models import InventoryItem, InventoryStatus
from app.quotation.models import Customer, Quotation, QuotationItem, QuotationStatus


def _delivered_with_stock(db, user_id):
    """Build a delivered inventory quotation (no payments) directly via ORM:
    one sale line linked to a SOLD stock item, one trade-in linked to an in_stock item."""
    cust = Customer(name="A")
    db.add(cust)
    db.flush()
    q = Quotation(customer_id=cust.id, status=QuotationStatus.delivered, created_by=user_id)
    db.add(q)
    db.flush()
    sold = InventoryItem(name="Laptop", purchase_price=500, selling_price=1000, status=InventoryStatus.sold)
    trade = InventoryItem(name="Old RAM", purchase_price=80, selling_price=150, status=InventoryStatus.in_stock)
    db.add_all([sold, trade])
    db.flush()
    db.add(QuotationItem(quotation_id=q.id, is_trade_in=False, name="Laptop", selling_price=1000, inventory_item_id=sold.id))
    db.add(QuotationItem(quotation_id=q.id, is_trade_in=True, name="Old RAM", purchase_price=80, resale_price=150, inventory_item_id=trade.id))
    db.commit()
    db.refresh(q)
    return q, sold, trade


def test_delete_releases_sold_and_reclaims_trade_in(client, sales_user, db_session):
    q, sold, trade = _delivered_with_stock(db_session, sales_user.id)
    r = client.delete(f"/api/quotations/{q.id}", headers=auth_headers(sales_user))
    assert r.status_code == 204
    db_session.expire_all()
    assert db_session.get(InventoryItem, sold.id).status == InventoryStatus.in_stock  # released
    assert db_session.get(InventoryItem, trade.id) is None  # reclaimed (deleted)


def test_delete_resets_linked_sale_item_selling_to_zero(client, sales_user, db_session):
    q, sold, _trade = _delivered_with_stock(db_session, sales_user.id)
    r = client.delete(f"/api/quotations/{q.id}", headers=auth_headers(sales_user))
    assert r.status_code == 204
    db_session.expire_all()
    released = db_session.get(InventoryItem, sold.id)
    assert released.status == InventoryStatus.in_stock
    assert int(released.selling_price) == 0  # sale price reset on delete


def test_delete_blocked_when_payments_exist(client, sales_user, db_session):
    q, _sold, _trade = _delivered_with_stock(db_session, sales_user.id)
    client.post(f"/api/quotations/{q.id}/payments", json={"amount": 100, "method": "cash"},
                headers=auth_headers(sales_user))
    r = client.delete(f"/api/quotations/{q.id}", headers=auth_headers(sales_user))
    assert r.status_code == 400  # must remove payments first


def test_delivered_quotation_item_edit_allowed(client, sales_user, db_session):
    q, _sold, _trade = _delivered_with_stock(db_session, sales_user.id)
    r = client.put(f"/api/quotations/{q.id}",
                   json={"items": [{"is_trade_in": False, "name": "Changed", "selling_price": 1}]},
                   headers=auth_headers(sales_user))
    assert r.status_code == 200  # delivered quotations stay editable
    assert next(i for i in r.json()["items"] if not i["is_trade_in"])["name"] == "Changed"
