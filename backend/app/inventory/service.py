from typing import Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.inventory.models import InventoryItem
from app.inventory.schemas import InventoryItemCreate, InventoryItemUpdate


def list_inventory(
    db: Session,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 100,
    sort: Optional[str] = None,
    exclude_ids: Optional[set] = None,
):
    query = db.query(InventoryItem)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(
                InventoryItem.name.ilike(pattern),
                InventoryItem.serial_number.ilike(pattern),
            )
        )
    if exclude_ids:
        query = query.filter(InventoryItem.id.notin_(exclude_ids))
    total = query.count()
    order = InventoryItem.name if sort == "name" else InventoryItem.created_at.desc()
    query = query.order_by(order)
    if limit and limit > 0:  # limit <= 0 means "return all"
        query = query.offset((page - 1) * limit).limit(limit)
    items = query.all()
    return items, total


def create_inventory_item(db: Session, data: InventoryItemCreate) -> InventoryItem:
    item = InventoryItem(**data.model_dump())
    db.add(item)
    db.flush()
    return item


def update_inventory_item(db: Session, item_id: int, data: InventoryItemUpdate) -> Optional[InventoryItem]:
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        return None
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    db.flush()
    return item


def delete_inventory_item(db: Session, item_id: int) -> bool:
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        return False
    db.delete(item)
    db.flush()
    return True
