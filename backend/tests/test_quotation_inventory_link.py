from conftest import auth_headers

import app.quotation.service as qsvc
from app.inventory.models import InventoryItem
from app.quotation.models import Customer, Quotation, QuotationItem, QuotationStatus


def _add_item(db, name="RAM"):
    it = InventoryItem(name=name, purchase_price=100, selling_price=200)
    db.add(it)
    db.commit()
    db.refresh(it)
    return it


def test_sale_link_persisted(client, sales_user, db_session):
    it = _add_item(db_session)
    q = client.post("/api/quotations", json={"new_customer": {"name": "A"},
                    "items": [{"is_trade_in": False, "name": "RAM", "selling_price": 200, "inventory_item_id": it.id}]},
                    headers=auth_headers(sales_user)).json()
    item = next(i for i in q["items"] if not i["is_trade_in"])
    assert item["inventory_item_id"] == it.id
    assert item["inventory_conflict"] is False


def test_duplicate_link_rejected(client, sales_user, db_session):
    it = _add_item(db_session)
    r = client.post("/api/quotations", json={"new_customer": {"name": "A"}, "items": [
        {"is_trade_in": False, "name": "RAM", "selling_price": 200, "inventory_item_id": it.id},
        {"is_trade_in": False, "name": "RAM", "selling_price": 200, "inventory_item_id": it.id},
    ]}, headers=auth_headers(sales_user))
    assert r.status_code == 400


def test_claimed_and_conflict(client, sales_user, db_session):
    it = _add_item(db_session)
    # A confirmed (claimed)
    cust = Customer(name="A"); db_session.add(cust); db_session.flush()
    qa = Quotation(customer_id=cust.id, status=QuotationStatus.confirmed, created_by=sales_user.id)
    db_session.add(qa); db_session.flush()
    db_session.add(QuotationItem(quotation_id=qa.id, is_trade_in=False, name="RAM", selling_price=200, inventory_item_id=it.id))
    db_session.commit()
    assert qsvc.get_claimed_inventory_ids(db_session) == {it.id}
    # B draft holding the same item -> conflict on detail
    qb = client.post("/api/quotations", json={"new_customer": {"name": "B"},
                     "items": [{"is_trade_in": False, "name": "RAM", "selling_price": 200, "inventory_item_id": it.id}]},
                     headers=auth_headers(sales_user)).json()
    detail = client.get(f"/api/quotations/{qb['id']}", headers=auth_headers(sales_user)).json()
    item = next(i for i in detail["items"] if not i["is_trade_in"])
    assert item["inventory_conflict"] is True
