from datetime import date
from decimal import Decimal

from app.finance.models import Transaction, TransactionType
from app.finance.service import get_yearly_revenue_profit

from conftest import auth_headers


def _txn(user_id, d, ttype, amount):
    return Transaction(
        date=d,
        description="x",
        type=ttype,
        amount=Decimal(amount),
        created_by=user_id,
    )


def test_yearly_revenue_profit_returns_12_zero_filled_months(db_session, admin_user):
    db_session.add(_txn(admin_user.id, date(2026, 2, 10), TransactionType.thu, 1000))
    db_session.add(_txn(admin_user.id, date(2026, 2, 15), TransactionType.chi, 300))
    db_session.commit()

    result = get_yearly_revenue_profit(db_session, 2026)

    assert len(result) == 12
    assert result[0] == {"month": 1, "revenue": 0, "profit": 0}
    assert result[1] == {"month": 2, "revenue": 1000, "profit": 700}


def test_yearly_revenue_profit_excludes_deleted_and_other_years(db_session, admin_user):
    db_session.add(_txn(admin_user.id, date(2025, 2, 1), TransactionType.thu, 999))
    deleted = _txn(admin_user.id, date(2026, 2, 1), TransactionType.thu, 500)
    deleted.is_deleted = True
    db_session.add(deleted)
    db_session.commit()

    result = get_yearly_revenue_profit(db_session, 2026)

    assert all(m["revenue"] == 0 and m["profit"] == 0 for m in result)


def test_dashboard_endpoint_returns_year_and_12_months(client, admin_user, db_session):
    db_session.add(_txn(admin_user.id, date(2026, 3, 1), TransactionType.thu, 500))
    db_session.commit()

    res = client.get("/api/dashboard?year=2026", headers=auth_headers(admin_user))

    assert res.status_code == 200
    body = res.json()
    assert body["year"] == 2026
    assert len(body["months"]) == 12
    assert body["months"][2] == {"month": 3, "revenue": 500, "profit": 500}


def test_dashboard_endpoint_defaults_year_when_omitted(client, admin_user):
    res = client.get("/api/dashboard", headers=auth_headers(admin_user))

    assert res.status_code == 200
    body = res.json()
    assert isinstance(body["year"], int)
    assert len(body["months"]) == 12
