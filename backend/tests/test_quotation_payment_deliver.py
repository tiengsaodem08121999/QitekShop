from conftest import auth_headers

from app.inventory.models import InventoryItem, InventoryStatus
from app.quotation.models import Customer, Quotation, QuotationItem, QuotationStatus


def _add_item(db, name="RAM"):
    it = InventoryItem(name=name, purchase_price=100, selling_price=200)
    db.add(it)
    db.commit()
    db.refresh(it)
    return it


def _quote(client, user, items):
    return client.post("/api/quotations", json={"new_customer": {"name": "A"}, "items": items},
                       headers=auth_headers(user)).json()


def _pay(client, user, qid, amount=100):
    return client.post(f"/api/quotations/{qid}/payments",
                       json={"amount": amount, "method": "cash"}, headers=auth_headers(user))


def test_first_payment_auto_confirms(client, sales_user, db_session):
    it = _add_item(db_session)
    q = _quote(client, sales_user, [{"is_trade_in": False, "name": "RAM", "selling_price": 200, "inventory_item_id": it.id}])
    assert _pay(client, sales_user, q["id"]).status_code == 201
    detail = client.get(f"/api/quotations/{q['id']}", headers=auth_headers(sales_user)).json()
    assert detail["status"] == "confirmed"


def test_payment_allowed_when_unlinked_auto_confirms(client, sales_user):
    # Linking is required only at delivery, not at payment.
    q = _quote(client, sales_user, [{"is_trade_in": False, "name": "Freebie", "selling_price": 200}])
    assert _pay(client, sales_user, q["id"]).status_code == 201
    detail = client.get(f"/api/quotations/{q['id']}", headers=auth_headers(sales_user)).json()
    assert detail["status"] == "confirmed"


def test_deliver_rejected_when_unlinked(client, sales_user):
    q = _quote(client, sales_user, [{"is_trade_in": False, "name": "Freebie", "selling_price": 200}])
    _pay(client, sales_user, q["id"])  # -> confirmed (unlinked allowed)
    r = client.patch(f"/api/quotations/{q['id']}/deliver", headers=auth_headers(sales_user))
    assert r.status_code == 400


def test_payment_rejected_on_conflict(client, sales_user, db_session):
    it = _add_item(db_session)
    cust = Customer(name="A"); db_session.add(cust); db_session.flush()
    qa = Quotation(customer_id=cust.id, status=QuotationStatus.confirmed, created_by=sales_user.id)
    db_session.add(qa); db_session.flush()
    db_session.add(QuotationItem(quotation_id=qa.id, is_trade_in=False, name="RAM", selling_price=200, inventory_item_id=it.id))
    db_session.commit()
    qb = _quote(client, sales_user, [{"is_trade_in": False, "name": "RAM", "selling_price": 200, "inventory_item_id": it.id}])
    assert _pay(client, sales_user, qb["id"]).status_code == 400


def test_payment_unlink_conflicts_proceeds(client, sales_user, db_session):
    it = _add_item(db_session)
    cust = Customer(name="A"); db_session.add(cust); db_session.flush()
    qa = Quotation(customer_id=cust.id, status=QuotationStatus.confirmed, created_by=sales_user.id)
    db_session.add(qa); db_session.flush()
    db_session.add(QuotationItem(quotation_id=qa.id, is_trade_in=False, name="RAM", selling_price=200, inventory_item_id=it.id))
    db_session.commit()
    qb = _quote(client, sales_user, [{"is_trade_in": False, "name": "RAM", "selling_price": 200, "inventory_item_id": it.id, "serial_number": "SN123"}])
    # Plain payment -> conflict (400)
    assert client.post(f"/api/quotations/{qb['id']}/payments", json={"amount": 100, "method": "cash"},
                       headers=auth_headers(sales_user)).status_code == 400
    # With unlink_conflicts -> proceeds: line unlinked (virtual), quotation confirmed
    r = client.post(f"/api/quotations/{qb['id']}/payments",
                    json={"amount": 100, "method": "cash", "unlink_conflicts": True}, headers=auth_headers(sales_user))
    assert r.status_code == 201, r.text
    detail = client.get(f"/api/quotations/{qb['id']}", headers=auth_headers(sales_user)).json()
    assert detail["status"] == "confirmed"
    line = next(i for i in detail["items"] if not i["is_trade_in"])
    assert line["inventory_item_id"] is None
    # Unlinking also clears the S/N carried over from the detached stock item.
    assert line["serial_number"] is None


def test_deliver_marks_sold(client, sales_user, db_session):
    it = _add_item(db_session)
    q = _quote(client, sales_user, [{"is_trade_in": False, "name": "RAM", "selling_price": 200, "inventory_item_id": it.id}])
    _pay(client, sales_user, q["id"])  # -> confirmed
    r = client.patch(f"/api/quotations/{q['id']}/deliver", headers=auth_headers(sales_user))
    assert r.status_code == 200 and r.json()["status"] == "delivered"
    db_session.expire_all()
    assert db_session.get(InventoryItem, it.id).status == InventoryStatus.sold


def test_deliver_rejected_when_not_confirmed(client, sales_user, db_session):
    it = _add_item(db_session)
    q = _quote(client, sales_user, [{"is_trade_in": False, "name": "RAM", "selling_price": 200, "inventory_item_id": it.id}])
    r = client.patch(f"/api/quotations/{q['id']}/deliver", headers=auth_headers(sales_user))
    assert r.status_code == 400
