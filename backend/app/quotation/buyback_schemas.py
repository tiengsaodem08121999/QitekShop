from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field

from app.quotation.schemas import DecimalModel


class BuybackItemInput(BaseModel):
    name: str = Field(max_length=200)
    serial_number: Optional[str] = Field(default=None, max_length=100)
    purchase_price: Decimal = Field(default=Decimal(0), ge=0)
    expected_price: Decimal = Field(default=Decimal(0), ge=0)
    # Only honoured on update, for a line already linked to stock by this buyback.
    inventory_item_id: Optional[int] = None


class BuybackSave(BaseModel):
    title: str = Field(max_length=200)
    note: Optional[str] = None
    items: List[BuybackItemInput] = []


class BuybackItemResponse(DecimalModel):
    id: int
    name: str
    serial_number: Optional[str]
    purchase_price: Decimal
    expected_price: Decimal
    # What the unit actually sold for; null until it is sold.
    selling_price: Optional[Decimal]
    inventory_item_id: Optional[int]
    # Sold: the whole line is read-only, as sold stock is.
    sold: bool
    # Sold, or held by a confirmed quotation: its expected price and removal are locked.
    locked: bool


class BuybackListItem(DecimalModel):
    id: int
    title: Optional[str]
    total_purchase: Decimal
    # Sum of actual sale prices of the units sold so far.
    total_resale: Decimal
    created_at: datetime
    # False once a unit is sold or held by a confirmed quotation.
    deletable: bool


class BuybackResponse(BuybackListItem):
    note: Optional[str]
    items: List[BuybackItemResponse]
