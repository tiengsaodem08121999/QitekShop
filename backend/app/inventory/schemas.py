import datetime as _dt
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel

from app.inventory.models import InventoryStatus


class DecimalModel(BaseModel):
    model_config = {"from_attributes": True, "json_encoders": {Decimal: float}}


class InventoryItemCreate(DecimalModel):
    name: str
    serial_number: Optional[str] = None
    purchase_price: Decimal = 0
    selling_price: Optional[Decimal] = None
    supplier: Optional[str] = None


class InventoryItemUpdate(DecimalModel):
    name: Optional[str] = None
    serial_number: Optional[str] = None
    purchase_price: Optional[Decimal] = None
    selling_price: Optional[Decimal] = None
    supplier: Optional[str] = None
    status: Optional[InventoryStatus] = None  # router restricts to in_stock/returned


class InventoryItemResponse(DecimalModel):
    id: int
    name: str
    serial_number: Optional[str]
    purchase_price: Decimal
    selling_price: Optional[Decimal]
    supplier: Optional[str]
    status: InventoryStatus
    is_claimed: bool = False
    in_use: bool = False
    created_at: _dt.datetime
    updated_at: _dt.datetime
