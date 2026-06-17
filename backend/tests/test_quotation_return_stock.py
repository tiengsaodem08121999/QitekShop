"""A customer return keeps the originally-sold stock item as 'sold' (preserving
the sale history) and creates a NEW in-stock item whose purchase price equals
the refund amount, so the returned unit can be resold with its own cost basis.

Deleting the return removes that new item — unless it has since been sold or
claimed by another quotation, in which case the deletion is blocked.
"""
from conftest import auth_headers

from app.inventory.models import InventoryItem, InventoryStatus
from app.quotation.models import Customer, Quotation, QuotationItem, QuotationStatus, Return
from app.quotation.service import get_claimed_inventory_ids


def _delivered_sale(db, user_id, serial="SN1"):
    cust = Customer(name="A")
    db.add(cust)
    db.flush()
    q = Quotation(customer_id=cust.id, status=QuotationStatus.delivered, created_by=user_id)
    db.add(q)
    db.flush()
    sold = InventoryItem(name="Laptop", serial_number=serial, purchase_price=500,
                         selling_price=1000, status=InventoryStatus.sold)
    db.add(sold)
    db.flush()
    db.add(QuotationItem(quotation_id=q.id, is_trade_in=False, name="Laptop",
                         selling_price=1000, serial_number=serial, inventory_item_id=sold.id))
    db.commit()
    db.refresh(q)
    return q, sold


def _post_return(client, user, q, selling_price=1000, refund_percent=80):
    return client.post(f"/api/quotations/{q.id}/returns",
                       json={"item_name": "Laptop", "reason": "customer_fault",
                             "selling_price": selling_price, "refund_percent": refund_percent},
                       headers=auth_headers(user))


def test_return_keeps_original_sold_and_creates_new_stock(client, sales_user, db_session):
    q, sold = _delivered_sale(db_session, sales_user.id)
    before = {i.id for i in db_session.query(InventoryItem).all()}
    r = _post_return(client, sales_user, q)
    assert r.status_code == 201, r.text
    db_session.expire_all()
    # Original stays sold (still claimed by the original quotation).
    assert db_session.get(InventoryItem, sold.id).status == InventoryStatus.sold
    assert get_claimed_inventory_ids(db_session) == {sold.id}
    # A new in-stock item exists: cost = refund (1000 * 80% = 800), price 0, serial copied.
    new = [i for i in db_session.query(InventoryItem).all() if i.id not in before]
    assert len(new) == 1
    ni = new[0]
    assert ni.status == InventoryStatus.in_stock
    assert ni.purchase_price == 800
    assert ni.selling_price == 0
    assert ni.serial_number == "SN1"
    assert ni.name == "Laptop"
    # The return record points to the new (restocked) item.
    assert db_session.get(Return, r.json()["id"]).inventory_item_id == ni.id


def test_delete_return_removes_new_stock_keeps_original(client, sales_user, db_session):
    q, sold = _delivered_sale(db_session, sales_user.id)
    r = _post_return(client, sales_user, q).json()
    db_session.expire_all()
    new_id = db_session.get(Return, r["id"]).inventory_item_id
    assert db_session.get(InventoryItem, new_id) is not None
    assert client.delete(f"/api/quotations/{q.id}/returns/{r['id']}",
                         headers=auth_headers(sales_user)).status_code == 204
    db_session.expire_all()
    assert db_session.get(InventoryItem, sold.id).status == InventoryStatus.sold  # unchanged
    assert db_session.get(InventoryItem, new_id) is None  # restock item removed


def test_delete_return_blocked_when_new_stock_sold_elsewhere(client, sales_user, db_session):
    q, sold = _delivered_sale(db_session, sales_user.id)
    r = _post_return(client, sales_user, q).json()
    db_session.expire_all()
    new_id = db_session.get(Return, r["id"]).inventory_item_id
    # B (confirmed) sells the new restocked item -> the return can no longer be undone.
    cust = Customer(name="B")
    db_session.add(cust)
    db_session.flush()
    qb = Quotation(customer_id=cust.id, status=QuotationStatus.confirmed, created_by=sales_user.id)
    db_session.add(qb)
    db_session.flush()
    db_session.add(QuotationItem(quotation_id=qb.id, is_trade_in=False, name="Laptop",
                                 selling_price=900, inventory_item_id=new_id))
    db_session.commit()
    resp = client.delete(f"/api/quotations/{q.id}/returns/{r['id']}", headers=auth_headers(sales_user))
    assert resp.status_code == 400
    db_session.expire_all()
    assert db_session.get(InventoryItem, new_id) is not None  # still in stock, not deleted
