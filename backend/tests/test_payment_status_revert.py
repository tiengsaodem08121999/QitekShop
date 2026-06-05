"""Deleting the last income payment reverts a confirmed quotation back to draft,
releasing the stock claim. Delivered quotations are not affected."""
from conftest import auth_headers

from app.inventory.models import InventoryItem
from app.quotation.models import Customer, Quotation, QuotationItem, QuotationStatus
from app.quotation.service import get_claimed_inventory_ids


def _add_item(db, name="RAM"):
    it = InventoryItem(name=name, purchase_price=100, selling_price=200)
    db.add(it)
    db.commit()
    db.refresh(it)
    return it


def test_delete_last_payment_reverts_to_draft(client, sales_user, db_session):
    it = _add_item(db_session)
    q = client.post("/api/quotations", json={"new_customer": {"name": "A"},
                    "items": [{"is_trade_in": False, "name": "RAM", "selling_price": 200, "inventory_item_id": it.id}]},
                    headers=auth_headers(sales_user)).json()
    pay = client.post(f"/api/quotations/{q['id']}/payments",
                      json={"amount": 100, "method": "cash"}, headers=auth_headers(sales_user)).json()
    db_session.expire_all()
    assert get_claimed_inventory_ids(db_session) == {it.id}  # confirmed -> claimed
    # Delete the only payment -> back to draft, claim released
    assert client.delete(f"/api/quotations/{q['id']}/payments/{pay['id']}", headers=auth_headers(sales_user)).status_code == 204
    detail = client.get(f"/api/quotations/{q['id']}", headers=auth_headers(sales_user)).json()
    assert detail["status"] == "draft"
    db_session.expire_all()
    assert get_claimed_inventory_ids(db_session) == set()


def test_delivered_not_reverted_by_payment_delete(client, sales_user, db_session):
    cust = Customer(name="A"); db_session.add(cust); db_session.flush()
    q = Quotation(customer_id=cust.id, status=QuotationStatus.delivered, created_by=sales_user.id)
    db_session.add(q); db_session.flush()
    db_session.add(QuotationItem(quotation_id=q.id, is_trade_in=False, name="X", selling_price=100))
    db_session.commit()
    pay = client.post(f"/api/quotations/{q.id}/payments",
                      json={"amount": 100, "method": "cash"}, headers=auth_headers(sales_user)).json()
    client.delete(f"/api/quotations/{q.id}/payments/{pay['id']}", headers=auth_headers(sales_user))
    detail = client.get(f"/api/quotations/{q.id}", headers=auth_headers(sales_user)).json()
    assert detail["status"] == "delivered"  # unchanged
