# backend/app/dashboard_router.py
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import extract, func
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.database import get_db
from app.finance.models import Transaction, TransactionType
from app.quotation.models import Quotation

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
def dashboard(
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    year, month = now.year, now.month

    quotation_count = (
        db.query(func.count(Quotation.id))
        .filter(
            extract("year", Quotation.created_at) == year,
            extract("month", Quotation.created_at) == month,
        )
        .scalar()
    )

    income = (
        db.query(func.coalesce(func.sum(Transaction.amount), 0))
        .filter(
            Transaction.type == TransactionType.thu,
            Transaction.is_deleted == False,
            extract("year", Transaction.date) == year,
            extract("month", Transaction.date) == month,
        )
        .scalar()
    )

    expense = (
        db.query(func.coalesce(func.sum(Transaction.amount), 0))
        .filter(
            Transaction.type == TransactionType.chi,
            Transaction.is_deleted == False,
            extract("year", Transaction.date) == year,
            extract("month", Transaction.date) == month,
        )
        .scalar()
    )

    return {
        "quotation_count": quotation_count,
        "total_income": income,
        "total_expense": expense,
        "month": month,
        "year": year,
    }
