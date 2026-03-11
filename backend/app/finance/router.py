# backend/app/finance/router.py
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_role
from app.auth.models import User, UserRole
from app.database import get_db
from app.finance.schemas import (
    MonthlySummary,
    TransactionCreate,
    TransactionResponse,
    TransactionUpdate,
)
from app.finance.service import (
    create_transaction,
    get_monthly_summary,
    list_transactions,
    soft_delete_transaction,
    update_transaction,
)

router = APIRouter(prefix="/api/finance", tags=["finance"])


@router.get("/transactions")
def list_transactions_endpoint(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    _user: User = Depends(require_role(UserRole.admin, UserRole.accountant)),
    db: Session = Depends(get_db),
):
    items, total = list_transactions(db, year, month, page, limit)
    return {
        "items": [TransactionResponse.model_validate(t) for t in items],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.post("/transactions", response_model=TransactionResponse, status_code=201)
def create_transaction_endpoint(
    data: TransactionCreate,
    user: User = Depends(require_role(UserRole.admin, UserRole.accountant)),
    db: Session = Depends(get_db),
):
    return create_transaction(db, data, user.id)


@router.put("/transactions/{txn_id}", response_model=TransactionResponse)
def update_transaction_endpoint(
    txn_id: int,
    data: TransactionUpdate,
    _user: User = Depends(require_role(UserRole.admin, UserRole.accountant)),
    db: Session = Depends(get_db),
):
    txn = update_transaction(db, txn_id, data)
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return txn


@router.delete("/transactions/{txn_id}", status_code=204)
def delete_transaction_endpoint(
    txn_id: int,
    _user: User = Depends(require_role(UserRole.admin, UserRole.accountant)),
    db: Session = Depends(get_db),
):
    if not soft_delete_transaction(db, txn_id):
        raise HTTPException(status_code=404, detail="Transaction not found")


@router.get("/summary", response_model=MonthlySummary)
def summary_endpoint(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    _user: User = Depends(require_role(UserRole.admin, UserRole.accountant)),
    db: Session = Depends(get_db),
):
    return get_monthly_summary(db, year, month)
