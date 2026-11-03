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


def _monthly_sums(rows) -> dict[int, tuple[int, int]]:
    return {int(m): (int(sell or 0), int(cost or 0)) for m, sell, cost in rows}


def get_yearly_sales_profit(db: Session, year: int) -> list[dict]:
    """Exactly 12 months of {month, revenue, cost, profit, quotation_profit, direct_profit}."""
    month_col = extract("month", Quotation.delivered_at)
    quotation_rows = (
        db.query(month_col, func.sum(QuotationItem.selling_price), func.sum(QuotationItem.purchase_price))
        .join(Quotation, Quotation.id == QuotationItem.quotation_id)
        .outerjoin(InventoryItem, InventoryItem.id == QuotationItem.inventory_item_id)
        .filter(
            Quotation.status == QuotationStatus.delivered,
            extract("year", Quotation.delivered_at) == year,
            QuotationItem.is_trade_in == False,  # noqa: E712
            InventoryItem.transaction_id.is_(None),
        )
        .group_by(month_col)
        .all()
    )
    txn_month = extract("month", Transaction.date)
    direct_rows = (
        db.query(txn_month, func.sum(InventoryItem.selling_price), func.sum(InventoryItem.purchase_price))
        .join(Transaction, Transaction.id == InventoryItem.transaction_id)
        .filter(
            Transaction.is_deleted == False,  # noqa: E712
            Transaction.type == TransactionType.thu,
            extract("year", Transaction.date) == year,
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
