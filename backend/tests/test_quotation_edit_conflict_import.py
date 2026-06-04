from conftest import auth_headers

from app.inventory.models import InventoryItem
from app.quotation.models import Customer, Quotation, QuotationItem, QuotationStatus


def _add_item(db, name="RAM"):
    it = InventoryItem(name=name, purchase_price=100, selling_price=200)
    db.add(it)
    db.commit()
    db.refresh(it)
    return it


def _confirmed_holding(db, user_id, item_id, name="RAM"):
    cust = Customer(name="A")
    db.add(cust)
    db.flush()
    q = Quotation(customer_id=cust.id, status=QuotationStatus.confirmed, created_by=user_id)
    db.add(q)
    db.flush()
    db.add(QuotationItem(quotation_id=q.id, is_trade_in=False, name=name, selling_price=200, inventory_item_id=item_id))
    db.commit()
    db.refresh(q)
    return q


def test_update_confirmed_to_grab_claimed_item_blocked(client, sales_user, db_session):
    it = _add_item(db_session)
    _confirmed_holding(db_session, sales_user.id, it.id)          # A claims it
    qb = _confirmed_holding(db_session, sales_user.id, None, name="Other")  # B confirmed, own line
    r = client.put(f"/api/quotations/{qb.id}",
                   json={"items": [{"is_trade_in": False, "name": "RAM", "selling_price": 200, "inventory_item_id": it.id}]},
                   headers=auth_headers(sales_user))
    assert r.status_code == 400  # err_item_conflict


def test_detail_import_trade_ins_creates_stock(client, sales_user, db_session):
    q = client.post("/api/quotations", json={"new_customer": {"name": "A"}, "items": [
        {"is_trade_in": False, "name": "X", "selling_price": 10},
        {"is_trade_in": True, "name": "Old GPU", "purchase_price": 200, "resale_price": 300},
    ]}, headers=auth_headers(sales_user)).json()
    assert db_session.query(InventoryItem).filter(InventoryItem.name == "Old GPU").count() == 0
    r = client.patch(f"/api/quotations/{q['id']}/import-trade-ins", headers=auth_headers(sales_user))
    assert r.status_code == 200, r.text
    db_session.expire_all()
    created = db_session.query(InventoryItem).filter(InventoryItem.name == "Old GPU").one()
    assert int(created.purchase_price) == 200 and int(created.selling_price) == 300
