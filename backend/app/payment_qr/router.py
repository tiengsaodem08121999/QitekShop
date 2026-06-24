from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_role
from app.auth.models import User, UserRole
from app.database import get_db
from app.payment_qr.schemas import PaymentQrCreate, PaymentQrResponse, PaymentQrUpdate
from app.payment_qr.service import (
    create_payment_qr,
    delete_payment_qr,
    list_payment_qrs,
    update_payment_qr,
)

router = APIRouter(prefix="/api/payment-qrs", tags=["payment-qrs"])


@router.get("", response_model=list[PaymentQrResponse])
def list_payment_qrs_endpoint(
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_payment_qrs(db)


@router.post("", response_model=PaymentQrResponse, status_code=201)
def create_payment_qr_endpoint(
    data: PaymentQrCreate,
    _user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    return create_payment_qr(db, data)


@router.put("/{qr_id}", response_model=PaymentQrResponse)
def update_payment_qr_endpoint(
    qr_id: int,
    data: PaymentQrUpdate,
    _user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    qr = update_payment_qr(db, qr_id, data)
    if not qr:
        raise HTTPException(status_code=404, detail="Payment QR not found")
    return qr


@router.delete("/{qr_id}", status_code=204)
def delete_payment_qr_endpoint(
    qr_id: int,
    _user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    if not delete_payment_qr(db, qr_id):
        raise HTTPException(status_code=404, detail="Payment QR not found")
