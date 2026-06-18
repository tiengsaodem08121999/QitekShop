# backend/app/finance/service.py
from decimal import Decimal
from typing import Optional, Tuple

from fastapi import HTTPException
from sqlalchemy import extract, func
from sqlalchemy.orm import Session

from app.finance.models import Transaction, TransactionType
from app.finance.schemas import TransactionCreate
from app.inventory.models import InventoryItem, InventoryStatus
from app.models import Setting


def _get_initial_balance(db: Session) -> Decimal:
    setting = db.query(Setting).filter_by(key="initial_balance").first()
    return Decimal(setting.value) if setting and setting.value else Decimal(0)


def _get_month_totals(db: Session, year: int, month: int) -> Tuple[Decimal, Decimal]:
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


def get_yearly_summary(db: Session, year: int) -> list[dict]:
    """Return summary for each month that has transactions in the given year."""
    months_with_data = (
        db.query(extract("month", Transaction.date))
        .filter(
            extract("year", Transaction.date) == year,
            Transaction.is_deleted == False,
        )
        .distinct()
        .all()
    )
    months = sorted([int(row[0]) for row in months_with_data])
    return [get_monthly_summary(db, year, m) for m in months]


def get_yearly_revenue_profit(db: Session, year: int) -> list[dict]:
    """Return exactly 12 months of {month, revenue, profit}, zero-filled.

    revenue = total income (thu); profit = income - expense (thu - chi).
    """
    series = []
    for month in range(1, 13):
        income, expense = _get_month_totals(db, year, month)
        series.append(
            {
                "month": month,
                "revenue": int(income),
                "profit": int(income - expense),
            }
        )
    return series


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


def attach_sold_items(db: Session, txns: list[Transaction]) -> None:
    """Attach a `.sold_items` list of dicts to each Transaction instance."""
    ids = [t.id for t in txns]
    by_txn: dict[int, list[dict]] = {}
    if ids:
        rows = (
            db.query(InventoryItem)
            .filter(InventoryItem.transaction_id.in_(ids))
            .all()
        )
        for it in rows:
            by_txn.setdefault(it.transaction_id, []).append(
                {
                    "inventory_item_id": it.id,
                    "name": it.name,
                    "selling_price": it.selling_price,
                }
            )
    for t in txns:
        t.sold_items = by_txn.get(t.id, [])


def _sell_items(db: Session, txn_id: int, sold_items: list) -> None:
    """Validate and mark each item sold, linking it to txn_id."""
    from app.quotation.service import get_claimed_inventory_ids

    claimed = get_claimed_inventory_ids(db)
    for si in sold_items:
        if si.selling_price is None or si.selling_price <= 0:
            raise HTTPException(status_code=400, detail="err_txn_sold_price_invalid")
        item = (
            db.query(InventoryItem)
            .filter(InventoryItem.id == si.inventory_item_id)
            .first()
        )
        if item is None:
            raise HTTPException(status_code=400, detail="err_txn_sold_item_not_found")
        if item.status != InventoryStatus.in_stock or item.id in claimed:
            raise HTTPException(status_code=400, detail="err_txn_sold_item_unavailable")
        item.status = InventoryStatus.sold
        item.selling_price = si.selling_price
        item.transaction_id = txn_id
    db.flush()


def create_transaction(db: Session, data: TransactionCreate, user_id: int) -> Transaction:
    sold = data.sold_items or []
    if sold and data.type != TransactionType.thu:
        raise HTTPException(status_code=400, detail="err_txn_sold_requires_income")
    txn = Transaction(**data.model_dump(exclude={"sold_items"}), created_by=user_id)
    db.add(txn)
    db.flush()
    _sell_items(db, txn.id, sold)
    db.commit()
    db.refresh(txn)
    attach_sold_items(db, [txn])
    return txn


def _rollback_items(db: Session, txn_id: int) -> None:
    """Return all items linked to txn_id back to stock."""
    items = (
        db.query(InventoryItem)
        .filter(InventoryItem.transaction_id == txn_id)
        .all()
    )
    for it in items:
        it.status = InventoryStatus.in_stock
        it.selling_price = None
        it.transaction_id = None
    db.flush()


def update_transaction(db: Session, txn_id: int, data: TransactionCreate) -> Optional[Transaction]:
    txn = db.query(Transaction).filter(Transaction.id == txn_id, Transaction.is_deleted == False).first()
    if not txn:
        return None
    new_type = data.type if data.type is not None else txn.type
    sold = data.sold_items or []
    if sold and new_type != TransactionType.thu:
        raise HTTPException(status_code=400, detail="err_txn_sold_requires_income")
    for key, value in data.model_dump(exclude={"sold_items"}, exclude_unset=True).items():
        setattr(txn, key, value)
    _rollback_items(db, txn_id)
    if new_type == TransactionType.thu:
        _sell_items(db, txn_id, sold)
    db.commit()
    db.refresh(txn)
    attach_sold_items(db, [txn])
    return txn


def soft_delete_transaction(db: Session, txn_id: int) -> bool:
    txn = db.query(Transaction).filter(Transaction.id == txn_id, Transaction.is_deleted == False).first()
    if not txn:
        return False
    txn.is_deleted = True
    db.commit()
    return True
