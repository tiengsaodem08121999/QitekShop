"""list_quotations must be able to return ALL rows (no pagination cap).

Regression for the quotations list page only fetching the first 20 rows.
"""
from app.quotation.models import Customer, Quotation
from app.quotation.service import list_quotations


def _seed_quotations(db_session, user_id: int, count: int) -> None:
    customer = Customer(name="Acme")
    db_session.add(customer)
    db_session.flush()
    for _ in range(count):
        db_session.add(Quotation(customer_id=customer.id, created_by=user_id))
    db_session.flush()


def test_limit_zero_returns_all_rows(db_session, admin_user):
    """limit=0 is the 'load all' sentinel: every row comes back, not just 20."""
    _seed_quotations(db_session, admin_user.id, 25)

    items, total = list_quotations(db_session, limit=0)

    assert total == 25
    assert len(items) == 25


def test_default_limit_still_paginates(db_session, admin_user):
    """A positive limit still caps the page (default behaviour preserved)."""
    _seed_quotations(db_session, admin_user.id, 25)

    items, total = list_quotations(db_session, limit=20)

    assert total == 25
    assert len(items) == 20
