"""Bug 1: a trade-in line in quotation A whose stock item is being sold by a
confirmed/delivered quotation B must lock its resale price and deletion.

The backend exposes this per-item via the transient `resale_locked` flag:
true only for a trade-in line whose linked stock is claimed by *another*
confirmed/delivered quotation.
"""
from conftest import auth_headers

from app.inventory.models import InventoryItem
from app.quotation.models import Customer, Quotation, QuotationItem, QuotationStatus


def _add_item(db, name="GPU"):
    it = InventoryItem(name=name, purchase_price=1500, selling_price=0)
    db.add(it)
    db.commit()
    db.refresh(it)
    return it


def _tradein_item(detail):
    return next(i for i in detail["items"] if i["is_trade_in"])


def test_tradein_resale_locked_when_sold_by_confirmed_quotation(client, sales_user, db_session):
    it = _add_item(db_session)
    cust = Customer(name="A"); db_session.add(cust); db_session.flush()
    # A: a trade-in line linked to the stock item (imported to stock).
    qa = Quotation(customer_id=cust.id, status=QuotationStatus.draft, created_by=sales_user.id)
    db_session.add(qa); db_session.flush()
    db_session.add(QuotationItem(quotation_id=qa.id, is_trade_in=True, name="GPU",
                                 purchase_price=1500, resale_price=2300, inventory_item_id=it.id))
    # B: confirmed, sells the same stock item (claims it).
    qb = Quotation(customer_id=cust.id, status=QuotationStatus.confirmed, created_by=sales_user.id)
    db_session.add(qb); db_session.flush()
    db_session.add(QuotationItem(quotation_id=qb.id, is_trade_in=False, name="GPU",
                                 selling_price=2300, inventory_item_id=it.id))
    db_session.commit()

    detail = client.get(f"/api/quotations/{qa.id}", headers=auth_headers(sales_user)).json()
    assert _tradein_item(detail)["resale_locked"] is True


def test_tradein_not_locked_when_other_quotation_is_draft(client, sales_user, db_session):
    it = _add_item(db_session)
    cust = Customer(name="A"); db_session.add(cust); db_session.flush()
    qa = Quotation(customer_id=cust.id, status=QuotationStatus.draft, created_by=sales_user.id)
    db_session.add(qa); db_session.flush()
    db_session.add(QuotationItem(quotation_id=qa.id, is_trade_in=True, name="GPU",
                                 purchase_price=1500, resale_price=2300, inventory_item_id=it.id))
    # B is still a draft -> no claim -> A's trade-in stays editable.
    qb = Quotation(customer_id=cust.id, status=QuotationStatus.draft, created_by=sales_user.id)
    db_session.add(qb); db_session.flush()
    db_session.add(QuotationItem(quotation_id=qb.id, is_trade_in=False, name="GPU",
                                 selling_price=2300, inventory_item_id=it.id))
    db_session.commit()

    detail = client.get(f"/api/quotations/{qa.id}", headers=auth_headers(sales_user)).json()
    assert _tradein_item(detail)["resale_locked"] is False


def test_sale_item_never_resale_locked(client, sales_user, db_session):
    it = _add_item(db_session)
    qa = client.post("/api/quotations", json={"new_customer": {"name": "A"},
                     "items": [{"is_trade_in": False, "name": "GPU", "selling_price": 2300, "inventory_item_id": it.id}]},
                     headers=auth_headers(sales_user)).json()
    detail = client.get(f"/api/quotations/{qa['id']}", headers=auth_headers(sales_user)).json()
    sale = next(i for i in detail["items"] if not i["is_trade_in"])
    assert sale["resale_locked"] is False
