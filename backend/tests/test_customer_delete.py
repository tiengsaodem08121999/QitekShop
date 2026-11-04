"""Customers can only be deleted while they have no quotations."""
from conftest import auth_headers

from app.quotation.models import Customer, Quotation, QuotationItem, QuotationStatus


def _customer(db, name="A"):
    cust = Customer(name=name)
    db.add(cust)
    db.commit()
    db.refresh(cust)
    return cust


def _quotation(db, customer_id, user_id, *, trade_in_only=False):
    q = Quotation(customer_id=customer_id, status=QuotationStatus.draft, created_by=user_id)
    db.add(q)
    db.flush()
    if trade_in_only:
        db.add(QuotationItem(quotation_id=q.id, is_trade_in=True, name="Old RAM",
                             purchase_price=80, resale_price=150))
    db.commit()
    return q


def test_delete_customer_without_quotations(client, sales_user, db_session):
    cust = _customer(db_session)
    r = client.delete(f"/api/customers/{cust.id}", headers=auth_headers(sales_user))
    assert r.status_code == 204
    db_session.expire_all()
    assert db_session.get(Customer, cust.id) is None


def test_delete_blocked_when_quotations_exist(client, sales_user, db_session):
    cust = _customer(db_session)
    _quotation(db_session, cust.id, sales_user.id)
    r = client.delete(f"/api/customers/{cust.id}", headers=auth_headers(sales_user))
    assert r.status_code == 400  # must delete the quotations first
    assert r.json()["detail"] == "err_customer_has_quotations"
    db_session.expire_all()
    assert db_session.get(Customer, cust.id) is not None


def test_delete_missing_customer_returns_404(client, sales_user):
    r = client.delete("/api/customers/9999", headers=auth_headers(sales_user))
    assert r.status_code == 404


def test_accountant_cannot_delete_customer(client, accountant_user, db_session):
    cust = _customer(db_session)
    r = client.delete(f"/api/customers/{cust.id}", headers=auth_headers(accountant_user))
    assert r.status_code == 403
    db_session.expire_all()
    assert db_session.get(Customer, cust.id) is not None


def test_list_counts_quotation_with_only_trade_in_items(client, sales_user, db_session):
    """quotation_count must not be derived from the sale-line aggregate: a
    trade-in-only quotation still blocks deletion."""
    cust = _customer(db_session)
    _quotation(db_session, cust.id, sales_user.id, trade_in_only=True)
    r = client.get("/api/customers", headers=auth_headers(sales_user))
    assert r.status_code == 200
    row = next(c for c in r.json()["items"] if c["id"] == cust.id)
    assert row["total_purchased"] == 0  # no sale lines
    assert row["quotation_count"] == 1  # ...but the quotation still exists
