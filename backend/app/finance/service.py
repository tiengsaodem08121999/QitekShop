# backend/app/finance/service.py
from decimal import Decimal

from sqlalchemy import extract, func
from sqlalchemy.orm import Session

from app.finance.models import Transaction, TransactionType
from app.finance.schemas import TransactionCreate, TransactionUpdate
from app.models import Setting


def _get_initial_balance(db: Session) -> Decimal:
    setting = db.query(Setting).filter_by(key="initial_balance").first()
    return Decimal(setting.value) if setting and setting.value else Decimal(0)


def _get_month_totals(db: Session, year: int, month: int) -> tuple[Decimal, Decimal]:
    """Returns (total_income, total_expense) for a given month."""
    result = (
        db.query(
            Transaction.type,
            func.coalesce(func.sum(Transaction.amount), 0),
        )
        .filter(
            extract("year", Transaction.date) == year,
            extract("month", Transaction.date) == month,
            Transaction.is_deleted == False,
        )
        .group_by(Transaction.type)
        .all()
    )
    totals = {row[0]: Decimal(row[1]) for row in result}
    return totals.get(TransactionType.thu, Decimal(0)), totals.get(TransactionType.chi, Decimal(0))


def get_opening_balance(db: Session, year: int, month: int) -> Decimal:
    """Compute opening balance by summing all transactions before this month."""
    initial = _get_initial_balance(db)

    income = (
        db.query(func.coalesce(func.sum(Transaction.amount), 0))
        .filter(
            Transaction.type == TransactionType.thu,
            Transaction.is_deleted == False,
            (extract("year", Transaction.date) * 100 + extract("month", Transaction.date))
            < (year * 100 + month),
        )
        .scalar()
    )

    expense = (
        db.query(func.coalesce(func.sum(Transaction.amount), 0))
        .filter(
            Transaction.type == TransactionType.chi,
            Transaction.is_deleted == False,
            (extract("year", Transaction.date) * 100 + extract("month", Transaction.date))
            < (year * 100 + month),
        )
        .scalar()
    )

    return initial + Decimal(income) - Decimal(expense)


def get_monthly_summary(db: Session, year: int, month: int) -> dict:
    opening = get_opening_balance(db, year, month)
    income, expense = _get_month_totals(db, year, month)
    profit = income - expense
    closing = opening + profit
    return {
        "year": year,
        "month": month,
        "opening_balance": opening,
        "total_income": income,
        "total_expense": expense,
        "profit": profit,
        "closing_balance": closing,
    }


def list_transactions(db: Session, year: int, month: int, page: int = 1, limit: int = 50):
    query = (
        db.query(Transaction)
        .filter(
            extract("year", Transaction.date) == year,
            extract("month", Transaction.date) == month,
            Transaction.is_deleted == False,
        )
        .order_by(Transaction.date, Transaction.id)
    )
    total = query.count()
    items = query.offset((page - 1) * limit).limit(limit).all()
    return items, total


def create_transaction(db: Session, data: TransactionCreate, user_id: int) -> Transaction:
    txn = Transaction(**data.model_dump(), created_by=user_id)
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return txn


def update_transaction(db: Session, txn_id: int, data: TransactionUpdate) -> Transaction | None:
    txn = db.query(Transaction).filter(Transaction.id == txn_id, Transaction.is_deleted == False).first()
    if not txn:
        return None
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(txn, key, value)
    db.commit()
    db.refresh(txn)
    return txn


def soft_delete_transaction(db: Session, txn_id: int) -> bool:
    txn = db.query(Transaction).filter(Transaction.id == txn_id, Transaction.is_deleted == False).first()
    if not txn:
        return False
    txn.is_deleted = True
    db.commit()
    return True
