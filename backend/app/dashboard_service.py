# backend/app/dashboard_service.py
"""Sales profit per month: selling price − purchase price of the goods sold.

A unit can be sold two ways, and each stock item is counted once:
  - a delivered quotation's sale lines, in the month it was delivered;
  - a Finance income transaction selling stock items directly, on its date.
A quotation line linked to a stock item that was sold through Finance is
skipped (the Finance sale is the real one). Trade-in lines are not sales; when
the traded-in unit is resold it counts as its own stock item. Returns are not
deducted: the returned unit re-enters stock at the refunded amount, so the
difference shows up when it is resold.
"""
from sqlalchemy import extract, func
from sqlalchemy.orm import Session

from app.finance.models import Transaction, TransactionType
from app.inventory.models import InventoryItem
from app.quotation.models import Quotation, QuotationItem, QuotationStatus


def _quotation_sales(db: Session, year: int, *columns):
    """Sale lines of quotations delivered in `year`, skipping units sold through Finance."""
    return (
        db.query(*columns)
        .select_from(QuotationItem)
        .join(Quotation, Quotation.id == QuotationItem.quotation_id)
        .outerjoin(InventoryItem, InventoryItem.id == QuotationItem.inventory_item_id)
        .filter(
            Quotation.status == QuotationStatus.delivered,
            extract("year", Quotation.delivered_at) == year,
            QuotationItem.is_trade_in == False,  # noqa: E712
            InventoryItem.transaction_id.is_(None),
        )
    )


def _direct_sales(db: Session, year: int, *columns):
    """Stock items sold by a live Finance income transaction dated in `year`."""
    return (
        db.query(*columns)
        .select_from(InventoryItem)
        .join(Transaction, Transaction.id == InventoryItem.transaction_id)
        .filter(
            Transaction.is_deleted == False,  # noqa: E712
            Transaction.type == TransactionType.thu,
            extract("year", Transaction.date) == year,
        )
    )


def _monthly_sums(rows) -> dict[int, tuple[int, int]]:
    return {int(m): (int(sell or 0), int(cost or 0)) for m, sell, cost in rows}


def get_yearly_sales_profit(db: Session, year: int) -> list[dict]:
    """Exactly 12 months of {month, revenue, cost, profit, quotation_profit, direct_profit}."""
    month_col = extract("month", Quotation.delivered_at)
    quotation_rows = (
        _quotation_sales(
            db, year, month_col, func.sum(QuotationItem.selling_price), func.sum(QuotationItem.purchase_price)
        )
        .group_by(month_col)
        .all()
    )
    txn_month = extract("month", Transaction.date)
    direct_rows = (
        _direct_sales(
            db, year, txn_month, func.sum(InventoryItem.selling_price), func.sum(InventoryItem.purchase_price)
        )
        .group_by(txn_month)
        .all()
    )
    quotation = _monthly_sums(quotation_rows)
    direct = _monthly_sums(direct_rows)

    series = []
    for month in range(1, 13):
        q_sell, q_cost = quotation.get(month, (0, 0))
        d_sell, d_cost = direct.get(month, (0, 0))
        series.append({
            "month": month,
            "revenue": q_sell + d_sell,
            "cost": q_cost + d_cost,
            "profit": (q_sell - q_cost) + (d_sell - d_cost),
            "quotation_profit": q_sell - q_cost,
            "direct_profit": d_sell - d_cost,
        })
    return series


def get_monthly_sales_detail(db: Session, year: int, month: int) -> dict:
    """The goods behind one month of the sales profit chart, with the same totals."""
    quotation_rows = (
        _quotation_sales(
            db, year, Quotation.delivered_at, QuotationItem.name,
            QuotationItem.purchase_price, QuotationItem.selling_price,
        )
        .filter(extract("month", Quotation.delivered_at) == month)
        .all()
    )
    direct_rows = (
        _direct_sales(
            db, year, Transaction.date, InventoryItem.name,
            InventoryItem.purchase_price, InventoryItem.selling_price,
        )
        .filter(extract("month", Transaction.date) == month)
        .all()
    )
    rows = sorted([*quotation_rows, *direct_rows], key=lambda r: (r[0], r[1]))
    items = [
        {"name": name, "purchase_price": int(cost or 0), "selling_price": int(sell or 0)}
        for _, name, cost, sell in rows
    ]
    total_purchase = sum(i["purchase_price"] for i in items)
    total_selling = sum(i["selling_price"] for i in items)
    return {
        "year": year,
        "month": month,
        "total_purchase": total_purchase,
        "total_selling": total_selling,
        "profit": total_selling - total_purchase,
        "items": items,
    }
