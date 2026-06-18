# backend/app/finance/schemas.py
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel

from app.finance.models import TransactionType


class DecimalModel(BaseModel):
    model_config = {"from_attributes": True, "json_encoders": {Decimal: float}}


class SoldItemInput(BaseModel):
    inventory_item_id: int
    selling_price: Decimal


class SoldItemResponse(DecimalModel):
    inventory_item_id: int
    name: str
    selling_price: Decimal


class TransactionCreate(BaseModel):
    date: date
    description: str
    type: TransactionType
    amount: Decimal
    notes: Optional[str] = None
    sold_items: Optional[list[SoldItemInput]] = None


class TransactionUpdate(BaseModel):
    date: Optional[date] = None
    description: Optional[str] = None
    type: Optional[TransactionType] = None
    amount: Optional[Decimal] = None
    notes: Optional[str] = None


class TransactionResponse(DecimalModel):
    id: int
    date: date
    description: str
    type: TransactionType
    amount: Decimal
    notes: Optional[str]
    created_by: int
    created_at: datetime
    sold_items: list[SoldItemResponse] = []


class MonthlySummary(DecimalModel):
    year: int
    month: int
    opening_balance: Decimal
    total_income: Decimal
    total_expense: Decimal
    profit: Decimal
    closing_balance: Decimal
