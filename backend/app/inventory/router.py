from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_role
from app.auth.models import User, UserRole
from app.database import get_db
from app.inventory.models import InventoryItem, InventoryStatus
from app.inventory.schemas import InventoryItemCreate, InventoryItemResponse, InventoryItemUpdate
from app.inventory.service import (
    create_inventory_item,
    delete_inventory_item,
    list_inventory,
    update_inventory_item,
)

router = APIRouter(prefix="/api/inventory", tags=["inventory"])


@router.get("")
def list_inventory_endpoint(
    search: Optional[str] = None,
    available: bool = False,
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=200),
    sort: Optional[str] = None,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.quotation.service import get_claimed_inventory_ids, get_referenced_inventory_ids
    claimed = get_claimed_inventory_ids(db)
    referenced = get_referenced_inventory_ids(db)
    items, total = list_inventory(db, search=search, page=page, limit=limit, sort=sort)
    result = []
    for i in items:
        if available and (i.status != InventoryStatus.in_stock or i.id in claimed):
            continue
        data = InventoryItemResponse.model_validate(i).model_dump()
        data["is_claimed"] = i.id in claimed
        data["in_use"] = i.id in referenced
        result.append(data)
    if available:
        total = len(result)
    return {"items": result, "total": total, "page": page, "limit": limit}


@router.post("", response_model=InventoryItemResponse, status_code=201)
def create_inventory_endpoint(
    data: InventoryItemCreate,
    _user: User = Depends(require_role(UserRole.admin, UserRole.sales)),
    db: Session = Depends(get_db),
):
    item = create_inventory_item(db, data)
    db.commit()
    db.refresh(item)
    return item


@router.put("/{item_id}", response_model=InventoryItemResponse)
def update_inventory_endpoint(
    item_id: int,
    data: InventoryItemUpdate,
    _user: User = Depends(require_role(UserRole.admin, UserRole.sales)),
    db: Session = Depends(get_db),
):
    if data.status is not None and data.status == InventoryStatus.sold:
        raise HTTPException(status_code=400, detail="err_inventory_no_manual_sold")
    existing = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if existing and existing.status == InventoryStatus.sold:
        raise HTTPException(status_code=400, detail="err_inventory_edit_sold")
    item = update_inventory_item(db, item_id, data)
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    from app.quotation.service import sync_stock_to_quotations
    sync_stock_to_quotations(db, item)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=204)
def delete_inventory_endpoint(
    item_id: int,
    _user: User = Depends(require_role(UserRole.admin, UserRole.sales)),
    db: Session = Depends(get_db),
):
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    # Sold items are view-only. Items referenced by a quotation can be deleted
    # (frontend warns first) — their quotation lines become free-text via SET NULL.
    if item and item.status == InventoryStatus.sold:
        raise HTTPException(status_code=400, detail="err_inventory_delete_sold")
    if not delete_inventory_item(db, item_id):
        raise HTTPException(status_code=404, detail="Inventory item not found")
    db.commit()
