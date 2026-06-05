"""A quotation return (customer returns to us) sends the stock item back to
'in_stock' (resellable). Deleting the return re-sells it (if delivered)."""
from conftest import auth_headers

from app.inventory.models import InventoryItem, InventoryStatus
from app.quotation.models import Customer, Quotation, QuotationItem, QuotationStatus
from app.quotation.service import get_claimed_inventory_ids


def _delivered_sale(db, user_id):
    cust = Customer(name="A")
    db.add(cust)
    db.flush()
    q = Quotation(customer_id=cust.id, status=QuotationStatus.delivered, created_by=user_id)
    db.add(q)
    db.flush()
    sold = InventoryItem(name="Laptop", purchase_price=500, selling_price=1000, status=InventoryStatus.sold)
    db.add(sold)
    db.flush()
    db.add(QuotationItem(quotation_id=q.id, is_trade_in=False, name="Laptop", selling_price=1000, inventory_item_id=sold.id))
    db.commit()
    db.refresh(q)
    return q, sold


def test_quotation_return_sends_stock_back(client, sales_user, db_session):
    q, sold = _delivered_sale(db_session, sales_user.id)
    assert get_claimed_inventory_ids(db_session) == {sold.id}
    r = client.post(f"/api/quotations/{q.id}/returns",
                    json={"item_name": "Laptop", "reason": "customer_fault", "selling_price": 1000},
                    headers=auth_headers(sales_user))
    assert r.status_code == 201, r.text
    db_session.expire_all()
    assert db_session.get(InventoryItem, sold.id).status == InventoryStatus.in_stock
    assert get_claimed_inventory_ids(db_session) == set()  # available to sell again


def test_delete_return_resells_stock(client, sales_user, db_session):
    q, sold = _delivered_sale(db_session, sales_user.id)
    r = client.post(f"/api/quotations/{q.id}/returns",
                    json={"item_name": "Laptop", "reason": "customer_fault", "selling_price": 1000},
                    headers=auth_headers(sales_user)).json()
    db_session.expire_all()
    assert db_session.get(InventoryItem, sold.id).status == InventoryStatus.in_stock
    assert client.delete(f"/api/quotations/{q.id}/returns/{r['id']}", headers=auth_headers(sales_user)).status_code == 204
    db_session.expire_all()
    assert db_session.get(InventoryItem, sold.id).status == InventoryStatus.sold
