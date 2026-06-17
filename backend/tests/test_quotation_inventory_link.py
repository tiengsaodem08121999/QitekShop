from datetime import date

from conftest import auth_headers

import app.quotation.service as qsvc
from app.inventory.models import InventoryItem
from app.quotation.models import Customer, Quotation, QuotationItem, QuotationStatus, Return, ReturnReason


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


def test_confirm_rejects_item_claimed_by_another_quotation(client, sales_user, db_session):
    """Two drafts may link the same stock item, but confirming the second one
    after the first is confirmed must be rejected (no oversell)."""
    it = _add_item(db_session)
    qa = client.post("/api/quotations", json={"new_customer": {"name": "A"},
                     "items": [{"is_trade_in": False, "name": "RAM", "selling_price": 200, "inventory_item_id": it.id}]},
                     headers=auth_headers(sales_user)).json()
    qb = client.post("/api/quotations", json={"new_customer": {"name": "B"},
                     "items": [{"is_trade_in": False, "name": "RAM", "selling_price": 200, "inventory_item_id": it.id}]},
                     headers=auth_headers(sales_user)).json()
    r1 = client.patch(f"/api/quotations/{qa['id']}/confirm", headers=auth_headers(sales_user))
    assert r1.status_code == 200
    r2 = client.patch(f"/api/quotations/{qb['id']}/confirm", headers=auth_headers(sales_user))
    assert r2.status_code == 400
    assert r2.json()["detail"] == "err_item_conflict"


def test_returned_item_still_claimed_by_other_quotation(client, sales_user, db_session):
    """A return only releases the returning quotation's claim. If another quotation
    legitimately re-claims the back-in-stock item, it must still count as claimed."""
    it = _add_item(db_session)
    cust = Customer(name="A"); db_session.add(cust); db_session.flush()
    # Q1: delivered, sold the item, then returned it (item back in stock; line still references it).
    q1 = Quotation(customer_id=cust.id, status=QuotationStatus.delivered, created_by=sales_user.id)
    db_session.add(q1); db_session.flush()
    db_session.add(QuotationItem(quotation_id=q1.id, is_trade_in=False, name="RAM", selling_price=200, inventory_item_id=it.id))
    db_session.add(Return(quotation_id=q1.id, item_name="RAM", inventory_item_id=it.id,
                          reason=ReturnReason.seller_fault, selling_price=200, refund_percent=100,
                          refund_amount=200, date=date.today(), created_by=sales_user.id))
    # Q2: confirmed, now claims the same (back-in-stock) item.
    q2 = Quotation(customer_id=cust.id, status=QuotationStatus.confirmed, created_by=sales_user.id)
    db_session.add(q2); db_session.flush()
    db_session.add(QuotationItem(quotation_id=q2.id, is_trade_in=False, name="RAM", selling_price=200, inventory_item_id=it.id))
    db_session.commit()
    assert qsvc.get_claimed_inventory_ids(db_session) == {it.id}


def test_return_frees_item_when_no_other_claim(db_session, sales_user):
    """Baseline: when only the returning quotation referenced the item, the return
    frees it entirely."""
    it = _add_item(db_session)
    cust = Customer(name="A"); db_session.add(cust); db_session.flush()
    q1 = Quotation(customer_id=cust.id, status=QuotationStatus.delivered, created_by=sales_user.id)
    db_session.add(q1); db_session.flush()
    db_session.add(QuotationItem(quotation_id=q1.id, is_trade_in=False, name="RAM", selling_price=200, inventory_item_id=it.id))
    db_session.add(Return(quotation_id=q1.id, item_name="RAM", inventory_item_id=it.id,
                          reason=ReturnReason.seller_fault, selling_price=200, refund_percent=100,
                          refund_amount=200, date=date.today(), created_by=sales_user.id))
    db_session.commit()
    assert qsvc.get_claimed_inventory_ids(db_session) == set()
