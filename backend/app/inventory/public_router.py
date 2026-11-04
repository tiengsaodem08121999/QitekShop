"""Public (no login) stock list for customers.

Exposes only what a customer may see: product name, customer-facing note and
expected price of units that are in stock and not already held by a confirmed
quotation. Purchase price, actual selling price, S/N, supplier and ids are
never returned.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.inventory.models import InventoryItem, InventoryStatus

router = APIRouter(prefix="/api/public", tags=["public"])


@router.get("/stock")
def public_stock(db: Session = Depends(get_db)):
    from app.quotation.service import get_claimed_inventory_ids
    claimed = get_claimed_inventory_ids(db)
    rows = (
        db.query(InventoryItem.id, InventoryItem.name, InventoryItem.note, InventoryItem.expected_price)
        .filter(InventoryItem.status == InventoryStatus.in_stock)
        .order_by(InventoryItem.created_at.desc(), InventoryItem.id.desc())
        .all()
    )
    return {
        "items": [
            {"name": name, "note": note, "expected_price": expected_price}
            for item_id, name, note, expected_price in rows
            if item_id not in claimed
        ]
    }
