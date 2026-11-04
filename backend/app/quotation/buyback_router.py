from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_role
from app.auth.models import User, UserRole
from app.database import get_db
from app.quotation.buyback_schemas import BuybackListItem, BuybackResponse, BuybackSave
from app.quotation.buyback_service import (
    create_buyback,
    delete_buyback,
    get_buyback,
    list_buybacks,
    update_buyback,
)

router = APIRouter(prefix="/api/buybacks", tags=["buyback"])


@router.get("", response_model=list[BuybackListItem])
def list_buybacks_endpoint(
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_buybacks(db)


@router.post("", response_model=BuybackResponse, status_code=201)
def create_buyback_endpoint(
    data: BuybackSave,
    user: User = Depends(require_role(UserRole.admin, UserRole.sales)),
    db: Session = Depends(get_db),
):
    try:
        return create_buyback(db, data, user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{buyback_id}", response_model=BuybackResponse)
def get_buyback_endpoint(
    buyback_id: int,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    buyback = get_buyback(db, buyback_id)
    if not buyback:
        raise HTTPException(status_code=404, detail="Buyback not found")
    return buyback


@router.put("/{buyback_id}", response_model=BuybackResponse)
def update_buyback_endpoint(
    buyback_id: int,
    data: BuybackSave,
    _user: User = Depends(require_role(UserRole.admin, UserRole.sales)),
    db: Session = Depends(get_db),
):
    try:
        buyback = update_buyback(db, buyback_id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not buyback:
        raise HTTPException(status_code=404, detail="Buyback not found")
    return buyback


@router.delete("/{buyback_id}", status_code=204)
def delete_buyback_endpoint(
    buyback_id: int,
    _user: User = Depends(require_role(UserRole.admin, UserRole.sales)),
    db: Session = Depends(get_db),
):
    try:
        deleted = delete_buyback(db, buyback_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not deleted:
        raise HTTPException(status_code=404, detail="Buyback not found")
